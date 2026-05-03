"use server";

import bcrypt from "bcryptjs";
import {
  BookingStatus,
  DashboardRole,
  HotelDataSourceMode,
  HotelStatus,
  Prisma,
  ProviderStatus,
  Role,
} from "@prisma/client";
import { addDays, differenceInCalendarDays } from "date-fns";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { clearSession, createSession, requireUser, setSessionProfileImage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { LANGUAGE_COOKIE_KEY, parseAppLanguage, type AppLanguage } from "@/lib/i18n";
import {
  createRapidBookingForRoom,
  encryptApiKey,
  runAutoRefreshForProviders,
  syncHotelProviderData,
  testHotelProviderConnection,
} from "@/lib/hotel-api";
import {
  MOCK_FAVORITES_COOKIE_KEY,
  isMockHotelId,
  parseMockFavoriteHotelIds,
  serializeMockFavoriteHotelIds,
} from "@/lib/mock-favorites";

const authSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email(),
  password: z.string().min(6),
});
const PROMOTED_ADMIN_EMAILS = new Set(
  (process.env.PROMOTED_ADMIN_EMAILS ?? "admin@bookmenow.co.il")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);
const ENFORCED_OWNER_EMAILS = new Set(
  (process.env.ENFORCED_OWNER_EMAILS ?? "owner@bookmenow.co.il")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

async function ensurePromotedAdminRole(params: { userId: string; email: string; role: Role }) {
  const normalizedEmail = params.email.trim().toLowerCase();
  if (
    ENFORCED_OWNER_EMAILS.has(normalizedEmail) ||
    !PROMOTED_ADMIN_EMAILS.has(normalizedEmail) ||
    params.role === Role.ADMIN
  ) {
    return params.role;
  }

  await prisma.user.update({
    where: { id: params.userId },
    data: { role: Role.ADMIN },
  });

  return Role.ADMIN;
}

async function ensureEnforcedOwnerRole(params: { userId: string; email: string; role: Role }) {
  const normalizedEmail = params.email.trim().toLowerCase();
  if (!ENFORCED_OWNER_EMAILS.has(normalizedEmail) || params.role === Role.OWNER) {
    return params.role;
  }

  await prisma.user.update({
    where: { id: params.userId },
    data: { role: Role.OWNER },
  });

  return Role.OWNER;
}

function parseListValue(input: string) {
  return input
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseBooleanValue(value: FormDataEntryValue | null, defaultValue = false) {
  if (value === null) {
    return defaultValue;
  }

  return String(value) === "true";
}
function isRapidProviderConfig(name: string, endpoint: string, hotelsPath: string) {
  const normalizedName = name.toLowerCase();
  const normalizedEndpoint = endpoint.toLowerCase();
  const normalizedPath = hotelsPath.toLowerCase();

  return (
    normalizedName.includes("rapid") ||
    normalizedEndpoint.includes("ean.com") ||
    normalizedEndpoint.includes("expediagroup.com") ||
    normalizedPath.includes("/properties/content") ||
    normalizedPath.includes("/properties/availability")
  );
}

async function parseUploadedImageFiles(formData: FormData, fieldName: string) {
  const files = formData
    .getAll(fieldName)
    .filter(
      (entry): entry is File => typeof File !== "undefined" && entry instanceof File && entry.size > 0,
    );

  if (files.length === 0) {
    return [];
  }

  return Promise.all(
    files.map(async (file) => {
      const bytes = Buffer.from(await file.arrayBuffer());
      const mimeType = file.type || "image/jpeg";
      return `data:${mimeType};base64,${bytes.toString("base64")}`;
    }),
  );
}

function parseHotelFacilities(formData: FormData) {
  const selectedFacilities = formData
    .getAll("facilityOptions")
    .map((entry) => String(entry).trim())
    .filter(Boolean);
  const additionalFacilities = parseListValue(String(formData.get("facilities") ?? ""));
  return Array.from(new Set([...selectedFacilities, ...additionalFacilities]));
}

async function parseHotelImages(formData: FormData) {
  const imageLinks = parseListValue(String(formData.get("images") ?? ""));
  const uploadedImages = await parseUploadedImageFiles(formData, "imageFiles");
  return [...imageLinks, ...uploadedImages];
}

function parseHotelLocation(formData: FormData) {
  const locationInput = String(formData.get("location") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim();
  const latitude = String(formData.get("latitude") ?? "").trim();
  const longitude = String(formData.get("longitude") ?? "").trim();

  const coordinateText = latitude && longitude ? `${latitude}, ${longitude}` : "";
  const addressLocation = [address, city, country].filter(Boolean).join(", ");
  const baseLocation = locationInput || addressLocation || coordinateText;
  const location =
    coordinateText && baseLocation && !baseLocation.includes(coordinateText)
      ? `${baseLocation} (${coordinateText})`
      : baseLocation;

  return {
    location,
    city: city || null,
    country: country || null,
  };
}

function isNonNegativeInteger(value: number) {
  return Number.isInteger(value) && value >= 0;
}

type RequestMetadata = {
  ipAddress: string | null;
  userAgent: string | null;
};

async function getRequestMetadata(): Promise<RequestMetadata> {
  const requestHeaders = await headers();
  return {
    ipAddress:
      requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      requestHeaders.get("x-real-ip"),
    userAgent: requestHeaders.get("user-agent"),
  };
}

type AuthMessageKey =
  | "invalidRegistrationDetails"
  | "emailAlreadyExists"
  | "invalidLoginDetails"
  | "userNotFoundOrBlocked"
  | "incorrectPassword"
  | "blockedAccount";

function getAuthMessage(language: AppLanguage, key: AuthMessageKey) {
  const messages =
    language === "he"
      ? {
          invalidRegistrationDetails: "פרטים לא תקינים",
          emailAlreadyExists: "האימייל כבר קיים במערכת",
          invalidLoginDetails: "פרטי התחברות לא תקינים",
          userNotFoundOrBlocked: "המשתמש לא נמצא או חסום",
          incorrectPassword: "סיסמה שגויה",
          blockedAccount: "החשבון חסום",
        }
      : {
          invalidRegistrationDetails: "Invalid registration details",
          emailAlreadyExists: "Email already exists",
          invalidLoginDetails: "Invalid login details",
          userNotFoundOrBlocked: "User not found or blocked",
          incorrectPassword: "Incorrect password",
          blockedAccount: "User account is blocked",
        };

  return messages[key];
}

async function getAuthActionLanguage() {
  const cookieStore = await cookies();
  return parseAppLanguage(cookieStore.get(LANGUAGE_COOKIE_KEY)?.value);
}

async function createLoginHistoryEntry(params: {
  userId?: string | null;
  email: string;
  success: boolean;
  message?: string;
}) {
  const requestMetadata = await getRequestMetadata();

  await prisma.userLoginHistory.create({
    data: {
      userId: params.userId ?? null,
      email: params.email,
      success: params.success,
      message: params.message,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
    },
  });
}

type AdminOrOwnerUser = {
  id: string;
  role: Role;
};

async function requireAdminOrOwnerUser(): Promise<AdminOrOwnerUser> {
  const user = await requireUser();
  if (user.role !== Role.ADMIN && user.role !== Role.OWNER) {
    redirect("/");
  }
  return { id: user.id, role: user.role };
}

async function findManagedHotel(params: {
  actor: AdminOrOwnerUser;
  hotelId: string;
  redirectPath?: "/admin/hotels" | "/admin/rooms";
}) {
  const where =
    params.actor.role === Role.ADMIN
      ? { id: params.hotelId }
      : { id: params.hotelId, ownerId: params.actor.id };
  const hotel = await prisma.hotel.findFirst({
    where,
    select: { id: true, ownerId: true, providerId: true },
  });

  if (!hotel) {
    redirect(`${params.redirectPath ?? "/admin/hotels"}?error=Hotel not found or access denied`);
  }

  return hotel;
}

async function findManagedRoom(params: {
  actor: AdminOrOwnerUser;
  roomId: string;
  redirectPath?: "/admin/hotels" | "/admin/rooms";
}) {
  const where =
    params.actor.role === Role.ADMIN
      ? { id: params.roomId }
      : { id: params.roomId, hotel: { ownerId: params.actor.id } };
  const room = await prisma.roomType.findFirst({
    where,
    select: { id: true, hotelId: true, name: true },
  });

  if (!room) {
    redirect(`${params.redirectPath ?? "/admin/rooms"}?error=Room not found or access denied`);
  }

  return room;
}

function resolveAdminRoomRedirectPath(formData: FormData) {
  const redirectTo = String(formData.get("redirectTo") ?? "").trim();
  if (redirectTo === "/admin/hotels" || redirectTo === "/admin/rooms") {
    return redirectTo;
  }
  return "/admin/rooms";
}

function parseRoomInventoryState(formData: FormData) {
  const inventory = Number(formData.get("inventory") ?? 1);
  const availableInventory = Number(formData.get("availableInventory") ?? inventory);
  const explicitAvailability = formData.get("isAvailable");
  const manuallyAvailable =
    explicitAvailability === null ? true : String(explicitAvailability) === "true";
  const isAvailable = manuallyAvailable && inventory > 0 && availableInventory > 0;

  return {
    inventory,
    availableInventory,
    isAvailable,
  };
}

async function createAdminActivityLog(params: {
  actorUserId?: string | null;
  targetUserId?: string | null;
  scope: string;
  action: string;
  details: string;
  metadata?: Prisma.InputJsonValue;
}) {
  await prisma.userActivityLog.create({
    data: {
      actorUserId: params.actorUserId ?? null,
      targetUserId: params.targetUserId ?? null,
      scope: params.scope,
      action: params.action,
      details: params.details,
      metadata: params.metadata,
    },
  });
}

export async function registerAction(formData: FormData) {
  const language = await getAuthActionLanguage();
  const parsed = authSchema.extend({ name: z.string().min(2) }).safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirect(`/register?error=${encodeURIComponent(getAuthMessage(language, "invalidRegistrationDetails"))}`);
  }

  const exists = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });

  if (exists) {
    redirect(`/register?error=${encodeURIComponent(getAuthMessage(language, "emailAlreadyExists"))}`);
  }

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: await bcrypt.hash(parsed.data.password, 10),
      role: Role.GUEST,
    },
  });

  await createSession(user.id);
  await setSessionProfileImage(null);
  redirect("/");
}

export async function loginAction(formData: FormData) {
  const language = await getAuthActionLanguage();
  const attemptedEmail = String(formData.get("email") ?? "").trim().toLowerCase();
  const parsed = authSchema.safeParse({
    email: attemptedEmail,
    password: formData.get("password"),
  });

  if (!parsed.success) {
    await createLoginHistoryEntry({
      email: attemptedEmail || "unknown",
      success: false,
      message: "Invalid login payload",
    });
    redirect(`/login?error=${encodeURIComponent(getAuthMessage(language, "invalidLoginDetails"))}`);
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });

  if (!user || user.blocked) {
    await createLoginHistoryEntry({
      userId: user?.id,
      email: parsed.data.email,
      success: false,
      message: user?.blocked ? "User is blocked" : "User not found",
    });
    redirect(`/login?error=${encodeURIComponent(getAuthMessage(language, "userNotFoundOrBlocked"))}`);
  }

  const isMatch = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!isMatch) {
    await createLoginHistoryEntry({
      userId: user.id,
      email: parsed.data.email,
      success: false,
      message: "Incorrect password",
    });
    redirect(`/login?error=${encodeURIComponent(getAuthMessage(language, "incorrectPassword"))}`);
  }
  const roleAfterOwnerEnforcement = await ensureEnforcedOwnerRole({
    userId: user.id,
    email: user.email,
    role: user.role,
  });
  await ensurePromotedAdminRole({
    userId: user.id,
    email: user.email,
    role: roleAfterOwnerEnforcement,
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  await createLoginHistoryEntry({
    userId: user.id,
    email: user.email,
    success: true,
    message: "Password login successful",
  });

  await createSession(user.id);
  await setSessionProfileImage(null);
  redirect("/");
}

export async function logoutAction() {
  await clearSession();
  redirect("/");
}
type OAuthProvider = "google" | "facebook" | "x";

type OAuthActionFallbackPath = "/login" | "/register";

const OAUTH_PROVIDER_TO_FIREBASE_PROVIDER_ID: Record<OAuthProvider, string> = {
  google: "google.com",
  facebook: "facebook.com",
  x: "twitter.com",
};

type FirebaseIdentityToolkitUser = {
  localId?: string;
  email?: string;
  displayName?: string;
  photoUrl?: string;
  providerUserInfo?: Array<{
    providerId?: string;
    photoUrl?: string;
  }>;
};

type FirebaseIdentityToolkitLookupResponse = {
  users?: FirebaseIdentityToolkitUser[];
};

async function verifyFirebaseIdentityToken(idToken: string) {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    throw new Error("Missing Firebase web API key");
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ idToken }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error("Firebase token verification failed");
  }

  const payload = (await response.json()) as FirebaseIdentityToolkitLookupResponse;
  const user = payload.users?.[0];
  if (!user) {
    throw new Error("Missing Firebase user in verification response");
  }

  return user;
}

function buildOAuthFallbackEmail(provider: OAuthProvider, localId?: string) {
  const normalizedLocalId = localId?.trim();
  if (!normalizedLocalId) {
    return null;
  }
  return `${provider}.${normalizedLocalId}@oauth.bookmenow.local`;
}

function normalizeOAuthProfileImageUrl(photoUrl?: string | null) {
  const normalizedUrl = photoUrl?.trim();
  if (!normalizedUrl) {
    return null;
  }

  if (!/^https?:\/\//i.test(normalizedUrl)) {
    return null;
  }

  return normalizedUrl;
}

function resolveOAuthProfileImageUrl(
  firebaseUser: FirebaseIdentityToolkitUser,
  expectedProviderId: string,
) {
  const providerPhotoUrl =
    firebaseUser.providerUserInfo?.find((providerInfo) => providerInfo.providerId === expectedProviderId)
      ?.photoUrl ??
    firebaseUser.providerUserInfo?.find((providerInfo) => Boolean(providerInfo.photoUrl))?.photoUrl ??
    firebaseUser.photoUrl;

  return normalizeOAuthProfileImageUrl(providerPhotoUrl);
}

async function completeOAuthSignInAction(options: {
  email: string;
  name: string;
  profileImageUrl?: string | null;
  providerLabel: string;
  fallbackPath: OAuthActionFallbackPath;
}) {
  const language = await getAuthActionLanguage();
  let user = await prisma.user.findUnique({
    where: { email: options.email },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        name: options.name,
        email: options.email,
        passwordHash: await bcrypt.hash(randomUUID(), 10),
        role: Role.GUEST,
      },
    });
  }

  if (user.blocked) {
    await createLoginHistoryEntry({
      userId: user.id,
      email: user.email,
      success: false,
      message: `${options.providerLabel} login blocked`,
    });
    redirect(`${options.fallbackPath}?error=${encodeURIComponent(getAuthMessage(language, "blockedAccount"))}`);
  }
  const roleAfterOwnerEnforcement = await ensureEnforcedOwnerRole({
    userId: user.id,
    email: user.email,
    role: user.role,
  });
  await ensurePromotedAdminRole({
    userId: user.id,
    email: user.email,
    role: roleAfterOwnerEnforcement,
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  await createLoginHistoryEntry({
    userId: user.id,
    email: user.email,
    success: true,
    message: `${options.providerLabel} login successful`,
  });

  await createSession(user.id);
  await setSessionProfileImage(options.profileImageUrl);
  redirect("/");
}
export async function oauthSignInAction(formData: FormData) {
  const language = await getAuthActionLanguage();
  const returnToInput = String(formData.get("returnTo") ?? "").trim();
  const fallbackPath: OAuthActionFallbackPath = returnToInput === "/register" ? "/register" : "/login";
  const idToken = String(formData.get("idToken") ?? "").trim();
  const providerInput = String(formData.get("provider") ?? "").trim().toLowerCase();

  if (
    !idToken ||
    (providerInput !== "google" && providerInput !== "facebook" && providerInput !== "x")
  ) {
    redirect(`${fallbackPath}?error=${encodeURIComponent(getAuthMessage(language, "invalidLoginDetails"))}`);
  }

  const provider = providerInput as OAuthProvider;
  const providerLabel = provider === "google" ? "Google" : provider === "facebook" ? "Facebook" : "X";

  let firebaseUser: FirebaseIdentityToolkitUser;
  try {
    firebaseUser = await verifyFirebaseIdentityToken(idToken);
  } catch {
    redirect(`${fallbackPath}?error=${encodeURIComponent(getAuthMessage(language, "invalidLoginDetails"))}`);
  }

  const connectedProviderIds = new Set(
    (firebaseUser.providerUserInfo ?? [])
      .map((providerInfo) => providerInfo.providerId?.trim())
      .filter((providerId): providerId is string => Boolean(providerId)),
  );
  const expectedProviderId = OAUTH_PROVIDER_TO_FIREBASE_PROVIDER_ID[provider];
  if (connectedProviderIds.size > 0 && !connectedProviderIds.has(expectedProviderId)) {
    redirect(`${fallbackPath}?error=${encodeURIComponent(getAuthMessage(language, "invalidLoginDetails"))}`);
  }

  const normalizedEmail =
    firebaseUser.email?.trim().toLowerCase() ??
    buildOAuthFallbackEmail(provider, firebaseUser.localId);
  if (!normalizedEmail) {
    redirect(`${fallbackPath}?error=${encodeURIComponent(getAuthMessage(language, "invalidLoginDetails"))}`);
  }

  const normalizedName = firebaseUser.displayName?.trim() || `${providerLabel} User`;
  const profileImageUrl = resolveOAuthProfileImageUrl(firebaseUser, expectedProviderId);

  await completeOAuthSignInAction({
    email: normalizedEmail,
    name: normalizedName,
    profileImageUrl,
    providerLabel,
    fallbackPath,
  });
}

export async function createBookingAction(formData: FormData) {
  const user = await requireUser(Role.GUEST);
  const bookingReturnPathInput = String(formData.get("bookingReturnPath") ?? "").trim();
  const bookingReturnPath =
    bookingReturnPathInput.startsWith("/") && !bookingReturnPathInput.startsWith("//")
      ? bookingReturnPathInput
      : "";
  const buildErrorRedirectPath = (fallbackPath: string, message: string) => {
    const basePath = bookingReturnPath || fallbackPath;
    const separator = basePath.includes("?") ? "&" : "?";
    return `${basePath}${separator}error=${encodeURIComponent(message)}`;
  };

  const roomTypeId = String(formData.get("roomTypeId") ?? "");
  const checkIn = new Date(String(formData.get("checkIn") ?? ""));
  const checkOut = new Date(String(formData.get("checkOut") ?? ""));
  const guests = Number(formData.get("guests") ?? 1);

  if (!roomTypeId || Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) {
    redirect(buildErrorRedirectPath("/", "פרטי הזמנה לא תקינים"));
  }

  if (checkOut <= checkIn) {
    redirect(buildErrorRedirectPath("/", "טווח תאריכים לא תקין"));
  }

  const room = await prisma.roomType.findUnique({
    where: { id: roomTypeId },
    include: { hotel: true },
  });

  if (!room || room.hotel.status !== HotelStatus.APPROVED) {
    redirect(buildErrorRedirectPath("/", "החדר אינו זמין"));
  }

  const activeInventory = Math.max(0, Math.min(room.inventory, room.availableInventory));
  if (!room.isAvailable || activeInventory < 1) {
    redirect(buildErrorRedirectPath(`/hotels/${room.hotelId}`, "החדר אינו זמין כרגע להזמנה"));
  }

  if (guests > room.maxGuests) {
    redirect(buildErrorRedirectPath(`/hotels/${room.hotelId}`, "מספר אורחים גבוה מהמותר"));
  }

  const overlapping = await prisma.booking.count({
    where: {
      roomTypeId,
      status: BookingStatus.CONFIRMED,
      checkIn: { lt: checkOut },
      checkOut: { gt: checkIn },
    },
  });

  if (overlapping >= activeInventory) {
    redirect(buildErrorRedirectPath(`/hotels/${room.hotelId}`, "החדר תפוס בתאריכים שבחרת"));
  }

  const blocked = await prisma.blockedDate.findFirst({
    where: {
      hotelId: room.hotelId,
      date: { gte: checkIn, lt: checkOut },
    },
  });

  if (blocked) {
    redirect(buildErrorRedirectPath(`/hotels/${room.hotelId}`, "המלון חסום באחד התאריכים"));
  }

  const nights = differenceInCalendarDays(checkOut, checkIn);
  const totalPrice = nights * room.pricePerNight;
  let rapidBookingWarning: string | null = null;
  let rapidBookingReference: string | null = null;

  if (room.hotel.providerId && room.hotel.externalHotelId && room.externalRoomId) {
    const rapidResult = await createRapidBookingForRoom({
      providerId: room.hotel.providerId,
      externalHotelId: room.hotel.externalHotelId,
      externalRoomId: room.externalRoomId,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      guests,
      customerEmail: user.email,
      customerName: user.name,
      affiliateReferenceId: `BMN-${randomUUID()}`,
    });

    if (!rapidResult.success) {
      if (process.env.RAPID_BOOKING_REQUIRED?.trim() === "true") {
        redirect(buildErrorRedirectPath(`/hotels/${room.hotelId}`, rapidResult.message));
      }
      rapidBookingWarning = rapidResult.message;
    } else if (rapidResult.itineraryId) {
      rapidBookingReference = rapidResult.itineraryId;
    }
  }

  await prisma.booking.create({
    data: {
      userId: user.id,
      hotelId: room.hotelId,
      roomTypeId,
      checkIn,
      checkOut,
      guests,
      totalPrice,
    },
  });

  revalidatePath("/bookings");
  const successMessage = rapidBookingReference
    ? `ההזמנה הושלמה בהצלחה (Rapid ${rapidBookingReference})`
    : "ההזמנה הושלמה בהצלחה";
  const bookingRedirectQuery = new URLSearchParams({
    success: successMessage,
  });
  if (rapidBookingWarning) {
    bookingRedirectQuery.set("warning", rapidBookingWarning);
  }
  redirect(`/bookings?${bookingRedirectQuery.toString()}`);
}

export async function cancelBookingAction(formData: FormData) {
  const user = await requireUser(Role.GUEST);
  const bookingId = String(formData.get("bookingId") ?? "");

  await prisma.booking.updateMany({
    where: { id: bookingId, userId: user.id },
    data: { status: BookingStatus.CANCELED },
  });

  revalidatePath("/bookings");
}

export async function addFavoriteAction(formData: FormData) {
  const user = await requireUser();
  const hotelId = String(formData.get("hotelId") ?? "");

  if (!hotelId) {
    redirect("/search");
  }

  await prisma.favorite.upsert({
    where: {
      userId_hotelId: {
        userId: user.id,
        hotelId,
      },
    },
    update: {},
    create: {
      userId: user.id,
      hotelId,
    },
  });

  revalidatePath("/search");
  revalidatePath("/favorites");
  revalidatePath(`/hotels/${hotelId}`);
}

export async function removeFavoriteAction(formData: FormData) {
  const user = await requireUser();
  const hotelId = String(formData.get("hotelId") ?? "");

  if (!hotelId) {
    redirect("/favorites");
  }

  await prisma.favorite.deleteMany({
    where: {
      userId: user.id,
      hotelId,
    },
  });

  revalidatePath("/search");
  revalidatePath("/favorites");
  revalidatePath(`/hotels/${hotelId}`);
}

export async function addMockFavoriteAction(formData: FormData) {
  await requireUser();
  const hotelId = String(formData.get("hotelId") ?? "");

  if (!isMockHotelId(hotelId)) {
    redirect("/search");
  }

  const cookieStore = await cookies();
  const currentIds = parseMockFavoriteHotelIds(cookieStore.get(MOCK_FAVORITES_COOKIE_KEY)?.value);
  const nextIds = [hotelId, ...currentIds.filter((id) => id !== hotelId)];

  cookieStore.set(MOCK_FAVORITES_COOKIE_KEY, serializeMockFavoriteHotelIds(nextIds), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/search");
  revalidatePath("/favorites");
  revalidatePath(`/hotels/${hotelId}`);
}

export async function removeMockFavoriteAction(formData: FormData) {
  await requireUser();
  const hotelId = String(formData.get("hotelId") ?? "");

  if (!isMockHotelId(hotelId)) {
    redirect("/favorites");
  }

  const cookieStore = await cookies();
  const currentIds = parseMockFavoriteHotelIds(cookieStore.get(MOCK_FAVORITES_COOKIE_KEY)?.value);
  const nextIds = currentIds.filter((id) => id !== hotelId);

  cookieStore.set(MOCK_FAVORITES_COOKIE_KEY, serializeMockFavoriteHotelIds(nextIds), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/search");
  revalidatePath("/favorites");
  revalidatePath(`/hotels/${hotelId}`);
}

export async function ownerCreateHotelAction(formData: FormData) {
  const user = await requireUser(Role.OWNER);
  const name = String(formData.get("name") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim();
  const contactEmail = String(formData.get("contactEmail") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const images = parseListValue(String(formData.get("images") ?? ""));
  const facilities = String(formData.get("facilities") ?? "")
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);

  if (!name || !location || !description) {
    redirect("/owner?error=יש למלא את כל שדות המלון");
  }

  await prisma.hotel.create({
    data: {
      ownerId: user.id,
      name,
      location,
      city: city || null,
      country: country || null,
      contactEmail: contactEmail || null,
      description,
      facilities,
      images,
      dataSourceMode: HotelDataSourceMode.MANUAL,
      manualOverride: false,
      status: HotelStatus.PENDING,
    },
  });

  revalidatePath("/owner");
}

export async function ownerRegisterAccommodationAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== Role.OWNER && user.role !== Role.ADMIN) {
    redirect("/");
  }
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim();
  const locationInput = String(formData.get("location") ?? "").trim();
  const location = locationInput || [address, city, country].filter(Boolean).join(", ");
  const contactEmail = String(formData.get("contactEmail") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const facilities = parseListValue(String(formData.get("facilities") ?? ""));
  const imageLinks = parseListValue(String(formData.get("images") ?? ""));
  const uploadedImages = await parseUploadedImageFiles(formData, "imageFiles");
  const images = [...imageLinks, ...uploadedImages];
  const roomName = String(formData.get("roomName") ?? "").trim() || "חדר סטנדרט";
  const pricePerNight = Number(formData.get("pricePerNight") ?? 0);
  const maxGuests = Math.max(1, Number(formData.get("maxGuests") ?? 2));
  const inventory = Math.max(1, Number(formData.get("inventory") ?? 1));
  const cancellationPolicy =
    String(formData.get("cancellationPolicy") ?? "").trim() || "ביטול חינם עד 48 שעות לפני ההגעה";

  if (
    !name ||
    !address ||
    !city ||
    !country ||
    !location ||
    !contactEmail ||
    !description ||
    !Number.isFinite(pricePerNight) ||
    pricePerNight <= 0
  ) {
    redirect("/owner/register-property?error=יש למלא את כל שדות הטופס");
  }

  const hotel = await prisma.hotel.create({
    data: {
      ownerId: user.id,
      name,
      location,
      city,
      country,
      contactEmail,
      description,
      facilities,
      images,
      dataSourceMode: HotelDataSourceMode.MANUAL,
      manualOverride: false,
      status: HotelStatus.PENDING,
    },
  });

  await prisma.roomType.create({
    data: {
      hotelId: hotel.id,
      name: roomName,
      pricePerNight,
      maxGuests,
      inventory,
      availableInventory: inventory,
      isAvailable: true,
      photos: images,
      cancellationPolicy,
    },
  });

  revalidatePath("/owner");
  redirect("/owner?success=מקום האירוח נרשם בהצלחה");
}

export async function ownerCreateRoomAction(formData: FormData) {
  const user = await requireUser(Role.OWNER);
  const hotelId = String(formData.get("hotelId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const pricePerNight = Number(formData.get("pricePerNight") ?? 0);
  const maxGuests = Number(formData.get("maxGuests") ?? 1);
  const { inventory, availableInventory, isAvailable } = parseRoomInventoryState(formData);
  const photos = parseListValue(String(formData.get("photos") ?? ""));
  const cancellationPolicy = String(formData.get("cancellationPolicy") ?? "").trim();

  if (
    !hotelId ||
    !name ||
    !cancellationPolicy ||
    !Number.isFinite(pricePerNight) ||
    !Number.isFinite(maxGuests) ||
    !isNonNegativeInteger(inventory) ||
    !isNonNegativeInteger(availableInventory) ||
    availableInventory > inventory ||
    pricePerNight <= 0 ||
    !Number.isInteger(maxGuests) ||
    maxGuests < 1
  ) {
    redirect("/owner?error=פרטי חדר לא תקינים");
  }

  const hotel = await prisma.hotel.findFirst({
    where: { id: hotelId, ownerId: user.id },
  });

  if (!hotel) {
    redirect("/owner?error=מלון לא נמצא");
  }

  await prisma.roomType.create({
    data: {
      hotelId,
      name,
      pricePerNight,
      maxGuests,
      inventory,
      availableInventory,
      isAvailable,
      photos,
      cancellationPolicy,
    },
  });

  revalidatePath("/owner");
}

export async function ownerBlockDateAction(formData: FormData) {
  const user = await requireUser(Role.OWNER);
  const hotelId = String(formData.get("hotelId") ?? "");
  const from = new Date(String(formData.get("from") ?? ""));
  const to = new Date(String(formData.get("to") ?? ""));

  const hotel = await prisma.hotel.findFirst({
    where: { id: hotelId, ownerId: user.id },
  });

  if (!hotel || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
    redirect("/owner?error=פרטי חסימה לא תקינים");
  }

  let current = from;
  while (current <= to) {
    await prisma.blockedDate.upsert({
      where: {
        hotelId_date: {
          hotelId,
          date: current,
        },
      },
      create: {
        hotelId,
        date: current,
      },
      update: {},
    });
    current = addDays(current, 1);
  }

  revalidatePath("/owner");
}

export async function adminApproveHotelAction(formData: FormData) {
  const admin = await requireUser(Role.ADMIN);
  const hotelId = String(formData.get("hotelId") ?? "");
  const status = String(formData.get("status") ?? "APPROVED") as HotelStatus;

  if (!Object.values(HotelStatus).includes(status)) {
    redirect("/admin?error=סטטוס לא תקין");
  }

  await prisma.hotel.update({
    where: { id: hotelId },
    data: { status },
  });
  await createAdminActivityLog({
    actorUserId: admin.id,
    scope: "hotel-management",
    action: "approve-hotel-status",
    details: `Set hotel ${hotelId} status to ${status}`,
    metadata: { hotelId, status },
  });

  revalidatePath("/admin");
  redirect("/admin?tab=hotels&success=Hotel status updated");
}

export async function adminUpdateUserAction(formData: FormData) {
  const admin = await requireUser(Role.ADMIN);
  const userId = String(formData.get("userId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const dashboardRoleInput = String(formData.get("dashboardRole") ?? "");
  const blocked = String(formData.get("blocked") ?? "") === "true";
  const featurePermissions = formData
    .getAll("permissions")
    .map((item) => String(item))
    .filter(Boolean);

  if (!userId || !name || !email) {
    redirect("/admin?tab=users&error=Missing required user fields");
  }

  if (!Object.values(DashboardRole).includes(dashboardRoleInput as DashboardRole)) {
    redirect("/admin?tab=users&error=Invalid dashboard role");
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      name,
      email,
      dashboardRole: dashboardRoleInput as DashboardRole,
      blocked,
      featurePermissions,
    },
  });
  await createAdminActivityLog({
    actorUserId: admin.id,
    targetUserId: userId,
    scope: "user-management",
    action: "update-user",
    details: `Updated user ${email} (${dashboardRoleInput})`,
    metadata: {
      dashboardRole: dashboardRoleInput,
      blocked,
      permissionCount: featurePermissions.length,
    },
  });

  revalidatePath("/admin");
  redirect("/admin?tab=users&success=User updated");
}

export async function adminDeleteUserAction(formData: FormData) {
  const admin = await requireUser(Role.ADMIN);
  const userId = String(formData.get("userId") ?? "");

  if (!userId) {
    redirect("/admin?tab=users&error=Missing user id");
  }

  if (userId === admin.id) {
    redirect("/admin?tab=users&error=Cannot delete your own admin user");
  }

  await prisma.user.delete({
    where: { id: userId },
  });
  await createAdminActivityLog({
    actorUserId: admin.id,
    targetUserId: userId,
    scope: "user-management",
    action: "delete-user",
    details: `Deleted user ${userId}`,
    metadata: { userId },
  });

  revalidatePath("/admin");
  redirect("/admin?tab=users&success=User deleted");
}

export async function adminResetPasswordAction(formData: FormData) {
  const admin = await requireUser(Role.ADMIN);
  const userId = String(formData.get("userId") ?? "");

  if (!userId) {
    redirect("/admin?tab=users&error=Missing user id");
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await bcrypt.hash("Temp1234!", 10),
    },
  });
  await createAdminActivityLog({
    actorUserId: admin.id,
    targetUserId: userId,
    scope: "user-management",
    action: "reset-password",
    details: `Reset password for user ${userId}`,
    metadata: { userId },
  });

  revalidatePath("/admin");
  redirect("/admin?tab=users&success=Password reset to Temp1234!");
}

export async function adminCreateHotelAction(formData: FormData) {
  const actor = await requireAdminOrOwnerUser();
  const ownerIdInput = String(formData.get("ownerId") ?? "");
  const ownerId = actor.role === Role.ADMIN ? ownerIdInput : actor.id;
  const name = String(formData.get("name") ?? "").trim();
  const { location, city, country } = parseHotelLocation(formData);
  const description = String(formData.get("description") ?? "").trim();
  const facilities = parseHotelFacilities(formData);
  const images = await parseHotelImages(formData);
  const providerIdInput = String(formData.get("providerId") ?? "").trim() || null;
  const providerId = actor.role === Role.ADMIN ? providerIdInput : null;
  const dataSourceModeInput =
    actor.role === Role.ADMIN
      ? String(formData.get("dataSourceMode") ?? HotelDataSourceMode.MANUAL)
      : HotelDataSourceMode.MANUAL;
  const manualOverride =
    actor.role === Role.ADMIN ? parseBooleanValue(formData.get("manualOverride"), false) : false;
  const ratingRaw = Number(formData.get("rating") ?? Number.NaN);
  const statusInput =
    actor.role === Role.ADMIN
      ? String(formData.get("status") ?? HotelStatus.APPROVED)
      : HotelStatus.PENDING;

  if (!ownerId || !name || !location || !description) {
    redirect("/admin/hotels?error=Missing required hotel fields");
  }

  if (!Object.values(HotelStatus).includes(statusInput as HotelStatus)) {
    redirect("/admin/hotels?error=Invalid hotel status");
  }

  if (!Object.values(HotelDataSourceMode).includes(dataSourceModeInput as HotelDataSourceMode)) {
    redirect("/admin/hotels?error=Invalid hotel source mode");
  }

  if (Number.isFinite(ratingRaw) && (ratingRaw < 1 || ratingRaw > 5)) {
    redirect("/admin/hotels?error=Rating must be between 1 and 5 stars");
  }

  if (dataSourceModeInput !== HotelDataSourceMode.MANUAL && !providerId) {
    redirect("/admin/hotels?error=Provider is required for API or Hybrid source mode");
  }

  if (providerId) {
    const provider = await prisma.hotelApiProvider.findUnique({ where: { id: providerId } });
    if (!provider) {
      redirect("/admin/hotels?error=Provider not found");
    }
  }

  const createdHotel = await prisma.hotel.create({
    data: {
      ownerId,
      providerId,
      name,
      location,
      city,
      country,
      description,
      facilities,
      images,
      rating: Number.isFinite(ratingRaw) ? ratingRaw : null,
      dataSourceMode: dataSourceModeInput as HotelDataSourceMode,
      manualOverride,
      status: statusInput as HotelStatus,
    },
  });
  await createAdminActivityLog({
    actorUserId: actor.id,
    targetUserId: ownerId,
    scope: "hotel-management",
    action: "create-hotel",
    details: `Created hotel ${createdHotel.name} (${createdHotel.id})`,
    metadata: {
      hotelId: createdHotel.id,
      sourceMode: dataSourceModeInput,
      providerId,
      manualOverride,
    },
  });

  revalidatePath("/admin/hotels");
  redirect("/admin/hotels?success=Hotel created");
}

export async function adminUpdateHotelAction(formData: FormData) {
  const admin = await requireUser(Role.ADMIN);

  const hotelId = String(formData.get("hotelId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const { location, city, country } = parseHotelLocation(formData);
  const description = String(formData.get("description") ?? "").trim();
  const facilities = parseHotelFacilities(formData);
  const images = await parseHotelImages(formData);
  const providerId = String(formData.get("providerId") ?? "").trim() || null;
  const dataSourceModeInput = String(formData.get("dataSourceMode") ?? HotelDataSourceMode.MANUAL);
  const manualOverride = parseBooleanValue(formData.get("manualOverride"), false);
  const ratingRaw = Number(formData.get("rating") ?? Number.NaN);
  const externalHotelId = String(formData.get("externalHotelId") ?? "").trim() || null;
  const statusInput = String(formData.get("status") ?? HotelStatus.PENDING);

  if (!hotelId || !name || !location || !description) {
    redirect("/admin/hotels?error=Missing required hotel fields");
  }

  if (!Object.values(HotelStatus).includes(statusInput as HotelStatus)) {
    redirect("/admin/hotels?error=Invalid hotel status");
  }

  if (!Object.values(HotelDataSourceMode).includes(dataSourceModeInput as HotelDataSourceMode)) {
    redirect("/admin/hotels?error=Invalid hotel source mode");
  }

  if (Number.isFinite(ratingRaw) && (ratingRaw < 1 || ratingRaw > 5)) {
    redirect("/admin/hotels?error=Rating must be between 1 and 5 stars");
  }

  if (dataSourceModeInput !== HotelDataSourceMode.MANUAL && !providerId) {
    redirect("/admin/hotels?error=Provider is required for API or Hybrid source mode");
  }

  if (providerId) {
    const provider = await prisma.hotelApiProvider.findUnique({ where: { id: providerId } });
    if (!provider) {
      redirect("/admin/hotels?error=Provider not found");
    }
  }

  await prisma.hotel.update({
    where: { id: hotelId },
    data: {
      providerId,
      externalHotelId,
      name,
      location,
      city,
      country,
      description,
      facilities,
      images,
      rating: Number.isFinite(ratingRaw) ? ratingRaw : null,
      dataSourceMode: dataSourceModeInput as HotelDataSourceMode,
      manualOverride,
      status: statusInput as HotelStatus,
    },
  });
  await createAdminActivityLog({
    actorUserId: admin.id,
    scope: "hotel-management",
    action: "update-hotel",
    details: `Updated hotel ${hotelId} (${name})`,
    metadata: {
      hotelId,
      sourceMode: dataSourceModeInput,
      providerId,
      manualOverride,
      status: statusInput,
    },
  });

  revalidatePath("/admin/hotels");
  redirect("/admin/hotels?success=Hotel updated");
}

export async function adminDeleteHotelAction(formData: FormData) {
  const actor = await requireAdminOrOwnerUser();
  const hotelId = String(formData.get("hotelId") ?? "");

  if (!hotelId) {
    redirect("/admin/hotels?error=Missing hotel id");
  }
  await findManagedHotel({ actor, hotelId });

  await prisma.hotel.delete({
    where: { id: hotelId },
  });
  await createAdminActivityLog({
    actorUserId: actor.id,
    scope: "hotel-management",
    action: "delete-hotel",
    details: `Deleted hotel ${hotelId}`,
    metadata: { hotelId },
  });

  revalidatePath("/admin/hotels");
  revalidatePath("/admin/rooms");
  redirect("/admin/hotels?success=Hotel deleted");
}

export async function adminCreateRoomAction(formData: FormData) {
  const actor = await requireAdminOrOwnerUser();
  const redirectPath = resolveAdminRoomRedirectPath(formData);

  const hotelId = String(formData.get("hotelId") ?? "");
  const externalRoomId = String(formData.get("externalRoomId") ?? "").trim() || null;
  const name = String(formData.get("name") ?? "").trim();
  const pricePerNight = Number(formData.get("pricePerNight") ?? 0);
  const maxGuests = Number(formData.get("maxGuests") ?? 1);
  const { inventory, availableInventory, isAvailable } = parseRoomInventoryState(formData);
  const cancellationPolicy = String(formData.get("cancellationPolicy") ?? "").trim();
  const photos = parseListValue(String(formData.get("photos") ?? ""));
  if (
    !hotelId ||
    !name ||
    !cancellationPolicy ||
    !Number.isFinite(pricePerNight) ||
    !Number.isInteger(maxGuests) ||
    !isNonNegativeInteger(inventory) ||
    !isNonNegativeInteger(availableInventory) ||
    pricePerNight <= 0 ||
    maxGuests < 1 ||
    availableInventory > inventory
  ) {
    redirect(`${redirectPath}?error=Invalid room details`);
  }

  await findManagedHotel({ actor, hotelId, redirectPath });

  const createdRoom = await prisma.roomType.create({
    data: {
      hotelId,
      externalRoomId,
      name,
      pricePerNight,
      maxGuests,
      inventory,
      availableInventory,
      isAvailable,
      cancellationPolicy,
      photos,
    },
  });
  await createAdminActivityLog({
    actorUserId: actor.id,
    scope: "hotel-management",
    action: "create-room",
    details: `Created room ${createdRoom.name} (${createdRoom.id}) for hotel ${hotelId}`,
    metadata: { roomId: createdRoom.id, hotelId, externalRoomId },
  });
  revalidatePath("/admin/hotels");

  revalidatePath("/admin/rooms");
  redirect(`${redirectPath}?success=Room added`);
}

export async function adminUpdateRoomAction(formData: FormData) {
  const actor = await requireAdminOrOwnerUser();
  const redirectPath = resolveAdminRoomRedirectPath(formData);

  const roomId = String(formData.get("roomId") ?? "");
  const externalRoomId = String(formData.get("externalRoomId") ?? "").trim() || null;
  const name = String(formData.get("name") ?? "").trim();
  const pricePerNight = Number(formData.get("pricePerNight") ?? 0);
  const maxGuests = Number(formData.get("maxGuests") ?? 1);
  const { inventory, availableInventory, isAvailable } = parseRoomInventoryState(formData);
  const cancellationPolicy = String(formData.get("cancellationPolicy") ?? "").trim();
  const photos = parseListValue(String(formData.get("photos") ?? ""));
  if (
    !roomId ||
    !name ||
    !cancellationPolicy ||
    !Number.isFinite(pricePerNight) ||
    !Number.isInteger(maxGuests) ||
    !isNonNegativeInteger(inventory) ||
    !isNonNegativeInteger(availableInventory) ||
    pricePerNight <= 0 ||
    maxGuests < 1 ||
    inventory < 0 ||
    availableInventory < 0 ||
    availableInventory > inventory
  ) {
    redirect(`${redirectPath}?error=Invalid room details`);
  }

  const room = await findManagedRoom({ actor, roomId, redirectPath });

  await prisma.roomType.update({
    where: { id: room.id },
    data: {
      externalRoomId,
      name,
      pricePerNight,
      maxGuests,
      inventory,
      availableInventory,
      isAvailable,
      cancellationPolicy,
      photos,
    },
  });
  await createAdminActivityLog({
    actorUserId: actor.id,
    scope: "hotel-management",
    action: "update-room",
    details: `Updated room ${roomId} (${name})`,
    metadata: {
      roomId,
      hotelId: room.hotelId,
      externalRoomId,
      inventory,
      availableInventory,
      isAvailable,
    },
  });
  revalidatePath("/admin/hotels");

  revalidatePath("/admin/rooms");
  redirect(`${redirectPath}?success=Room updated`);
}

export async function adminDeleteRoomAction(formData: FormData) {
  const actor = await requireAdminOrOwnerUser();
  const redirectPath = resolveAdminRoomRedirectPath(formData);
  const roomId = String(formData.get("roomId") ?? "");

  if (!roomId) {
    redirect(`${redirectPath}?error=Missing room id`);
  }
  const room = await findManagedRoom({ actor, roomId, redirectPath });

  await prisma.roomType.delete({
    where: { id: room.id },
  });
  await createAdminActivityLog({
    actorUserId: actor.id,
    scope: "hotel-management",
    action: "delete-room",
    details: `Deleted room ${roomId}`,
    metadata: { roomId, hotelId: room.hotelId },
  });
  revalidatePath("/admin/hotels");

  revalidatePath("/admin/rooms");
  redirect(`${redirectPath}?success=Room deleted`);
}

export async function adminCreateProviderAction(formData: FormData) {
  const admin = await requireUser(Role.ADMIN);

  const name = String(formData.get("name") ?? "").trim();
  const endpoint = String(formData.get("endpoint") ?? "").trim();
  const hotelsPath = String(formData.get("hotelsPath") ?? "/hotels").trim() || "/hotels";
  const apiKey = String(formData.get("apiKey") ?? "").trim();
  const apiSecret = String(formData.get("apiSecret") ?? "").trim();
  const enabled = parseBooleanValue(formData.get("enabled"), true);
  const autoRefreshEnabled = parseBooleanValue(formData.get("autoRefreshEnabled"), false);
  const refreshIntervalMinutes = Math.max(1, Number(formData.get("refreshIntervalMinutes") ?? 60));

  if (!name || !endpoint || !apiKey) {
    redirect("/admin?tab=integrations&error=Name, endpoint, and API key are required");
  }
  if (isRapidProviderConfig(name, endpoint, hotelsPath) && !apiSecret) {
    redirect("/admin?tab=integrations&error=Rapid provider requires shared secret");
  }

  const provider = await prisma.hotelApiProvider.create({
    data: {
      name,
      endpoint,
      hotelsPath,
      apiKeyEncrypted: encryptApiKey(apiKey),
      apiSecretEncrypted: apiSecret ? encryptApiKey(apiSecret) : null,
      enabled,
      autoRefreshEnabled,
      refreshIntervalMinutes,
      status: enabled ? ProviderStatus.ERROR : ProviderStatus.DISABLED,
    },
  });

  await prisma.hotelApiSyncLog.create({
    data: {
      providerId: provider.id,
      action: "create-provider",
      level: "INFO",
      message: "Provider created",
    },
  });
  await createAdminActivityLog({
    actorUserId: admin.id,
    scope: "api-integrations",
    action: "create-provider",
    details: `Created provider ${provider.name} (${provider.id})`,
    metadata: { providerId: provider.id, endpoint, enabled, autoRefreshEnabled },
  });

  revalidatePath("/admin");
  redirect("/admin?tab=integrations&success=Provider created");
}

export async function adminUpdateProviderAction(formData: FormData) {
  const admin = await requireUser(Role.ADMIN);

  const providerId = String(formData.get("providerId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const endpoint = String(formData.get("endpoint") ?? "").trim();
  const hotelsPath = String(formData.get("hotelsPath") ?? "/hotels").trim() || "/hotels";
  const apiKey = String(formData.get("apiKey") ?? "").trim();
  const apiSecret = String(formData.get("apiSecret") ?? "").trim();
  const enabled = parseBooleanValue(formData.get("enabled"), true);
  const autoRefreshEnabled = parseBooleanValue(formData.get("autoRefreshEnabled"), false);
  const refreshIntervalMinutes = Math.max(1, Number(formData.get("refreshIntervalMinutes") ?? 60));

  if (!providerId || !name || !endpoint) {
    redirect("/admin?tab=integrations&error=Missing required provider fields");
  }

  const existingProvider = await prisma.hotelApiProvider.findUnique({ where: { id: providerId } });
  if (!existingProvider) {
    redirect("/admin?tab=integrations&error=Provider not found");
  }
  if (
    isRapidProviderConfig(name, endpoint, hotelsPath) &&
    !apiSecret &&
    !existingProvider.apiSecretEncrypted
  ) {
    redirect("/admin?tab=integrations&error=Rapid provider requires shared secret");
  }

  await prisma.hotelApiProvider.update({
    where: { id: providerId },
    data: {
      name,
      endpoint,
      hotelsPath,
      ...(apiKey ? { apiKeyEncrypted: encryptApiKey(apiKey) } : {}),
      ...(apiSecret ? { apiSecretEncrypted: encryptApiKey(apiSecret) } : {}),
      enabled,
      autoRefreshEnabled,
      refreshIntervalMinutes,
      status: enabled ? existingProvider.status : ProviderStatus.DISABLED,
      ...(enabled ? {} : { lastError: null }),
    },
  });

  await prisma.hotelApiSyncLog.create({
    data: {
      providerId,
      action: "update-provider",
      level: "INFO",
      message: "Provider updated",
    },
  });
  await createAdminActivityLog({
    actorUserId: admin.id,
    scope: "api-integrations",
    action: "update-provider",
    details: `Updated provider ${providerId} (${name})`,
    metadata: { providerId, enabled, autoRefreshEnabled, refreshIntervalMinutes },
  });

  revalidatePath("/admin");
  redirect("/admin?tab=integrations&success=Provider updated");
}

export async function adminToggleProviderAction(formData: FormData) {
  const admin = await requireUser(Role.ADMIN);
  const providerId = String(formData.get("providerId") ?? "");
  const enabled = parseBooleanValue(formData.get("enabled"), false);

  if (!providerId) {
    redirect("/admin?tab=integrations&error=Missing provider id");
  }

  await prisma.hotelApiProvider.update({
    where: { id: providerId },
    data: {
      enabled,
      status: enabled ? ProviderStatus.ERROR : ProviderStatus.DISABLED,
      ...(enabled ? {} : { lastError: null }),
    },
  });

  await prisma.hotelApiSyncLog.create({
    data: {
      providerId,
      action: "toggle-provider",
      level: "INFO",
      message: enabled ? "Provider enabled" : "Provider disabled",
    },
  });
  await createAdminActivityLog({
    actorUserId: admin.id,
    scope: "api-integrations",
    action: "toggle-provider",
    details: `${enabled ? "Enabled" : "Disabled"} provider ${providerId}`,
    metadata: { providerId, enabled },
  });

  revalidatePath("/admin");
  redirect("/admin?tab=integrations&success=Provider status updated");
}

export async function adminTestProviderConnectionAction(formData: FormData) {
  const admin = await requireUser(Role.ADMIN);
  const providerId = String(formData.get("providerId") ?? "");

  if (!providerId) {
    redirect("/admin?tab=integrations&error=Missing provider id");
  }

  const result = await testHotelProviderConnection(providerId);
  await createAdminActivityLog({
    actorUserId: admin.id,
    scope: "api-integrations",
    action: "test-provider-connection",
    details: `Connection test for provider ${providerId}: ${result.success ? "success" : "error"}`,
    metadata: { providerId, success: result.success, message: result.message },
  });

  revalidatePath("/admin");
  redirect(
    `/admin?tab=integrations&${result.success ? "success" : "error"}=${encodeURIComponent(result.message)}`,
  );
}

export async function adminSyncProviderAction(formData: FormData) {
  const admin = await requireUser(Role.ADMIN);
  const providerId = String(formData.get("providerId") ?? "");

  if (!providerId) {
    redirect("/admin?tab=integrations&error=Missing provider id");
  }

  const result = await syncHotelProviderData(providerId, "manual");
  await createAdminActivityLog({
    actorUserId: admin.id,
    scope: "api-integrations",
    action: "manual-provider-sync",
    details: `Manual sync for provider ${providerId}: ${result.success ? "success" : "error"}`,
    metadata: {
      providerId,
      success: result.success,
      message: result.message,
      importedCount: result.importedCount,
    },
  });
  revalidatePath("/admin");
  redirect(
    `/admin?tab=integrations&${result.success ? "success" : "error"}=${encodeURIComponent(result.message)}`,
  );
}

export async function adminSyncHotelFromProviderAction(formData: FormData) {
  const admin = await requireUser(Role.ADMIN);
  const hotelId = String(formData.get("hotelId") ?? "");

  if (!hotelId) {
    redirect("/admin?tab=hotels&error=Missing hotel id");
  }

  const hotel = await prisma.hotel.findUnique({
    where: { id: hotelId },
    select: { providerId: true },
  });

  if (!hotel?.providerId) {
    redirect("/admin?tab=hotels&error=Hotel has no API provider");
  }

  const result = await syncHotelProviderData(hotel.providerId, "manual");
  await createAdminActivityLog({
    actorUserId: admin.id,
    scope: "hotel-management",
    action: "sync-hotel-from-provider",
    details: `Synced hotel ${hotelId} from provider ${hotel.providerId}: ${result.success ? "success" : "error"}`,
    metadata: {
      hotelId,
      providerId: hotel.providerId,
      success: result.success,
      message: result.message,
      importedCount: result.importedCount,
    },
  });
  revalidatePath("/admin");
  redirect(`/admin?tab=hotels&${result.success ? "success" : "error"}=${encodeURIComponent(result.message)}`);
}

export async function adminRefreshAllProvidersAction() {
  const admin = await requireUser(Role.ADMIN);

  const providers = await prisma.hotelApiProvider.findMany({
    where: { enabled: true },
    select: { id: true },
  });

  if (providers.length === 0) {
    redirect("/admin?tab=integrations&error=No enabled providers found");
  }

  for (const provider of providers) {
    await syncHotelProviderData(provider.id, "manual");
  }

  await runAutoRefreshForProviders();
  await createAdminActivityLog({
    actorUserId: admin.id,
    scope: "api-integrations",
    action: "refresh-all-providers",
    details: `Triggered refresh for ${providers.length} enabled providers`,
    metadata: { providerCount: providers.length, providerIds: providers.map((provider) => provider.id) },
  });
  revalidatePath("/admin/rooms");
  redirect("/admin/rooms?success=Room updated");
}

export async function adminSetHotelOverrideAction(formData: FormData) {
  const admin = await requireUser(Role.ADMIN);
  const hotelId = String(formData.get("hotelId") ?? "");
  const manualOverride = parseBooleanValue(formData.get("manualOverride"), false);

  if (!hotelId) {
    redirect("/admin?tab=hotels&error=Missing hotel id");
  }

  const hotel = await prisma.hotel.findUnique({
    where: { id: hotelId },
    select: { dataSourceMode: true },
  });

  if (!hotel) {
    redirect("/admin?tab=hotels&error=Hotel not found");
  }

  await prisma.hotel.update({
    where: { id: hotelId },
    data: {
      manualOverride,
      dataSourceMode:
        manualOverride && hotel.dataSourceMode === HotelDataSourceMode.API
          ? HotelDataSourceMode.HYBRID
          : hotel.dataSourceMode,
    },
  });
  await createAdminActivityLog({
    actorUserId: admin.id,
    scope: "hotel-management",
    action: "set-hotel-override",
    details: `${manualOverride ? "Enabled" : "Disabled"} manual override for hotel ${hotelId}`,
    metadata: { hotelId, manualOverride },
  });

  revalidatePath("/admin");
  redirect("/admin?tab=hotels&success=Hotel override updated");
}

export async function adminSetHotelSourceModeAction(formData: FormData) {
  const admin = await requireUser(Role.ADMIN);
  const hotelId = String(formData.get("hotelId") ?? "");
  const sourceModeInput = String(formData.get("dataSourceMode") ?? HotelDataSourceMode.MANUAL);

  if (!hotelId) {
    redirect("/admin?tab=hotels&error=Missing hotel id");
  }

  if (!Object.values(HotelDataSourceMode).includes(sourceModeInput as HotelDataSourceMode)) {
    redirect("/admin?tab=hotels&error=Invalid source mode");
  }

  const hotel = await prisma.hotel.findUnique({
    where: { id: hotelId },
    select: { providerId: true },
  });

  if (!hotel) {
    redirect("/admin?tab=hotels&error=Hotel not found");
  }

  if (sourceModeInput !== HotelDataSourceMode.MANUAL && !hotel.providerId) {
    redirect("/admin?tab=hotels&error=Cannot set API or Hybrid mode without a provider");
  }

  await prisma.hotel.update({
    where: { id: hotelId },
    data: {
      dataSourceMode: sourceModeInput as HotelDataSourceMode,
    },
  });
  await createAdminActivityLog({
    actorUserId: admin.id,
    scope: "hotel-management",
    action: "set-hotel-source-mode",
    details: `Set hotel ${hotelId} source mode to ${sourceModeInput}`,
    metadata: { hotelId, sourceMode: sourceModeInput },
  });

  revalidatePath("/admin");
  redirect("/admin?tab=hotels&success=Hotel source mode updated");
}

export async function adminToggleUserBlockAction(formData: FormData) {
  const admin = await requireUser(Role.ADMIN);
  const userId = String(formData.get("userId") ?? "");
  const blocked = String(formData.get("blocked") ?? "") === "true";

  await prisma.user.update({
    where: { id: userId },
    data: { blocked },
  });
  await createAdminActivityLog({
    actorUserId: admin.id,
    targetUserId: userId,
    scope: "user-management",
    action: "toggle-user-block",
    details: `${blocked ? "Blocked" : "Unblocked"} user ${userId}`,
    metadata: { userId, blocked },
  });

  revalidatePath("/admin");
  redirect(`/admin?tab=users&success=${blocked ? "User blocked" : "User unblocked"}`);
}

export async function adminCreateRoleDefinitionAction(formData: FormData) {
  const admin = await requireUser(Role.ADMIN);
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const permissions = parseListValue(String(formData.get("permissions") ?? ""));

  if (!name) {
    redirect("/admin/roles?error=Role name is required");
  }

  await prisma.roleDefinition.create({
    data: {
      name,
      description: description || null,
      permissions,
    },
  });

  await createAdminActivityLog({
    actorUserId: admin.id,
    scope: "role-management",
    action: "create-role-definition",
    details: `Created role definition ${name}`,
    metadata: { name, permissionsCount: permissions.length },
  });

  revalidatePath("/admin/roles");
  redirect("/admin/roles?success=Role created");
}

export async function adminUpdateRoleDefinitionAction(formData: FormData) {
  const admin = await requireUser(Role.ADMIN);
  const roleId = String(formData.get("roleId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const permissions = parseListValue(String(formData.get("permissions") ?? ""));

  if (!roleId || !name) {
    redirect("/admin/roles?error=Invalid role update payload");
  }

  await prisma.roleDefinition.update({
    where: { id: roleId },
    data: {
      name,
      description: description || null,
      permissions,
    },
  });

  await createAdminActivityLog({
    actorUserId: admin.id,
    scope: "role-management",
    action: "update-role-definition",
    details: `Updated role definition ${roleId}`,
    metadata: { roleId, name, permissionsCount: permissions.length },
  });

  revalidatePath("/admin/roles");
  redirect("/admin/roles?success=Role updated");
}

export async function adminDeleteRoleDefinitionAction(formData: FormData) {
  const admin = await requireUser(Role.ADMIN);
  const roleId = String(formData.get("roleId") ?? "");

  if (!roleId) {
    redirect("/admin/roles?error=Missing role id");
  }

  await prisma.user.updateMany({
    where: { customRoleId: roleId },
    data: { customRoleId: null },
  });
  await prisma.roleDefinition.delete({
    where: { id: roleId },
  });

  await createAdminActivityLog({
    actorUserId: admin.id,
    scope: "role-management",
    action: "delete-role-definition",
    details: `Deleted role definition ${roleId}`,
    metadata: { roleId },
  });

  revalidatePath("/admin/roles");
  redirect("/admin/roles?success=Role deleted");
}

export async function adminAssignUserRoleDefinitionAction(formData: FormData) {
  const admin = await requireUser(Role.ADMIN);
  const userId = String(formData.get("userId") ?? "");
  const roleIdRaw = String(formData.get("roleId") ?? "").trim();
  const roleId = roleIdRaw || null;

  if (!userId) {
    redirect("/admin/roles?error=Missing user id");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { customRoleId: roleId },
  });

  await createAdminActivityLog({
    actorUserId: admin.id,
    targetUserId: userId,
    scope: "role-management",
    action: "assign-user-role-definition",
    details: `Assigned custom role ${roleId ?? "none"} to user ${userId}`,
    metadata: { userId, roleId },
  });

  revalidatePath("/admin/roles");
  redirect("/admin/roles?success=User role updated");
}

export async function adminUpsertSystemSettingAction(formData: FormData) {
  const admin = await requireUser(Role.ADMIN);
  const key = String(formData.get("key") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const value = String(formData.get("value") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!key || !category) {
    redirect("/admin/settings?error=Setting key and category are required");
  }

  await prisma.systemSetting.upsert({
    where: { key },
    update: {
      category,
      value,
      description: description || null,
    },
    create: {
      key,
      category,
      value,
      description: description || null,
    },
  });

  await createAdminActivityLog({
    actorUserId: admin.id,
    scope: "system-settings",
    action: "upsert-system-setting",
    details: `Upserted setting ${key}`,
    metadata: { key, category },
  });

  revalidatePath("/admin/settings");
  redirect("/admin/settings?success=Setting saved");
}

export async function adminDeleteSystemSettingAction(formData: FormData) {
  const admin = await requireUser(Role.ADMIN);
  const settingId = String(formData.get("settingId") ?? "");

  if (!settingId) {
    redirect("/admin/settings?error=Missing setting id");
  }

  await prisma.systemSetting.delete({
    where: { id: settingId },
  });

  await createAdminActivityLog({
    actorUserId: admin.id,
    scope: "system-settings",
    action: "delete-system-setting",
    details: `Deleted system setting ${settingId}`,
    metadata: { settingId },
  });

  revalidatePath("/admin/settings");
  redirect("/admin/settings?success=Setting deleted");
}

export async function adminCreateHostingPropertyAction(formData: FormData) {
  const admin = await requireUser(Role.ADMIN);
  const ownerIdRaw = String(formData.get("ownerId") ?? "").trim();
  const ownerId = ownerIdRaw || null;
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim();
  const contactEmail = String(formData.get("contactEmail") ?? "").trim();
  const facilities = parseListValue(String(formData.get("facilities") ?? ""));
  const images = parseListValue(String(formData.get("images") ?? ""));

  if (!name || !description || !location || !city || !country || !contactEmail) {
    redirect("/admin/properties?error=Missing required hosting property fields");
  }

  await prisma.hostingProperty.create({
    data: {
      ownerId,
      name,
      description,
      location,
      city,
      country,
      contactEmail,
      facilities,
      images,
    },
  });

  await createAdminActivityLog({
    actorUserId: admin.id,
    targetUserId: ownerId,
    scope: "hosting-properties",
    action: "create-hosting-property",
    details: `Created hosting property ${name}`,
    metadata: { name, city, country },
  });

  revalidatePath("/admin/properties");
  redirect("/admin/properties?success=Hosting property created");
}

export async function adminUpdateHostingPropertyAction(formData: FormData) {
  const admin = await requireUser(Role.ADMIN);
  const propertyId = String(formData.get("propertyId") ?? "");
  const ownerIdRaw = String(formData.get("ownerId") ?? "").trim();
  const ownerId = ownerIdRaw || null;
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim();
  const contactEmail = String(formData.get("contactEmail") ?? "").trim();
  const facilities = parseListValue(String(formData.get("facilities") ?? ""));
  const images = parseListValue(String(formData.get("images") ?? ""));

  if (!propertyId || !name || !description || !location || !city || !country || !contactEmail) {
    redirect("/admin/properties?error=Invalid hosting property update payload");
  }

  await prisma.hostingProperty.update({
    where: { id: propertyId },
    data: {
      ownerId,
      name,
      description,
      location,
      city,
      country,
      contactEmail,
      facilities,
      images,
    },
  });

  await createAdminActivityLog({
    actorUserId: admin.id,
    targetUserId: ownerId,
    scope: "hosting-properties",
    action: "update-hosting-property",
    details: `Updated hosting property ${propertyId}`,
    metadata: { propertyId, name },
  });

  revalidatePath("/admin/properties");
  redirect("/admin/properties?success=Hosting property updated");
}

export async function adminDeleteHostingPropertyAction(formData: FormData) {
  const admin = await requireUser(Role.ADMIN);
  const propertyId = String(formData.get("propertyId") ?? "");

  if (!propertyId) {
    redirect("/admin/properties?error=Missing hosting property id");
  }

  await prisma.hostingProperty.delete({
    where: { id: propertyId },
  });

  await createAdminActivityLog({
    actorUserId: admin.id,
    scope: "hosting-properties",
    action: "delete-hosting-property",
    details: `Deleted hosting property ${propertyId}`,
    metadata: { propertyId },
  });

  revalidatePath("/admin/properties");
  redirect("/admin/properties?success=Hosting property deleted");
}

export async function adminCreateDealAction(formData: FormData) {
  const admin = await requireUser(Role.ADMIN);
  const hotelId = String(formData.get("hotelId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const dealPrice = Number(formData.get("dealPrice") ?? 0);
  const validFrom = new Date(String(formData.get("validFrom") ?? ""));
  const validTo = new Date(String(formData.get("validTo") ?? ""));
  const isActive = parseBooleanValue(formData.get("isActive"), true);

  if (
    !hotelId ||
    !title ||
    !description ||
    !Number.isFinite(dealPrice) ||
    dealPrice <= 0 ||
    Number.isNaN(validFrom.getTime()) ||
    Number.isNaN(validTo.getTime())
  ) {
    redirect("/admin/deals?error=Invalid deal payload");
  }

  await prisma.deal.create({
    data: {
      hotelId,
      title,
      description,
      dealPrice,
      validFrom,
      validTo,
      isActive,
    },
  });

  await createAdminActivityLog({
    actorUserId: admin.id,
    scope: "deals-management",
    action: "create-deal",
    details: `Created deal ${title} for hotel ${hotelId}`,
    metadata: { hotelId, title, dealPrice },
  });

  revalidatePath("/admin/deals");
  redirect("/admin/deals?success=Deal created");
}

export async function adminUpdateDealAction(formData: FormData) {
  const admin = await requireUser(Role.ADMIN);
  const dealId = String(formData.get("dealId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const dealPrice = Number(formData.get("dealPrice") ?? 0);
  const validFrom = new Date(String(formData.get("validFrom") ?? ""));
  const validTo = new Date(String(formData.get("validTo") ?? ""));
  const isActive = parseBooleanValue(formData.get("isActive"), true);

  if (
    !dealId ||
    !title ||
    !description ||
    !Number.isFinite(dealPrice) ||
    dealPrice <= 0 ||
    Number.isNaN(validFrom.getTime()) ||
    Number.isNaN(validTo.getTime())
  ) {
    redirect("/admin/deals?error=Invalid deal update payload");
  }

  await prisma.deal.update({
    where: { id: dealId },
    data: {
      title,
      description,
      dealPrice,
      validFrom,
      validTo,
      isActive,
    },
  });

  await createAdminActivityLog({
    actorUserId: admin.id,
    scope: "deals-management",
    action: "update-deal",
    details: `Updated deal ${dealId}`,
    metadata: { dealId, title, dealPrice, isActive },
  });

  revalidatePath("/admin/deals");
  redirect("/admin/deals?success=Deal updated");
}

export async function adminDeleteDealAction(formData: FormData) {
  const admin = await requireUser(Role.ADMIN);
  const dealId = String(formData.get("dealId") ?? "");

  if (!dealId) {
    redirect("/admin/deals?error=Missing deal id");
  }

  await prisma.deal.delete({
    where: { id: dealId },
  });

  await createAdminActivityLog({
    actorUserId: admin.id,
    scope: "deals-management",
    action: "delete-deal",
    details: `Deleted deal ${dealId}`,
    metadata: { dealId },
  });

  revalidatePath("/admin/deals");
  redirect("/admin/deals?success=Deal deleted");
}

export async function adminUpsertRoomAvailabilityRangeAction(formData: FormData) {
  const admin = await requireUser(Role.ADMIN);
  const roomTypeId = String(formData.get("roomTypeId") ?? "");
  const from = new Date(String(formData.get("from") ?? ""));
  const to = new Date(String(formData.get("to") ?? ""));
  const isAvailable = parseBooleanValue(formData.get("isAvailable"), true);
  const priceRaw = String(formData.get("priceOverride") ?? "").trim();
  const priceOverride = priceRaw ? Number(priceRaw) : null;

  if (!roomTypeId || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
    redirect("/admin/availability?error=Invalid availability range");
  }

  let current = from;
  while (current <= to) {
    await prisma.roomAvailabilityOverride.upsert({
      where: {
        roomTypeId_date: {
          roomTypeId,
          date: current,
        },
      },
      update: {
        isAvailable,
        priceOverride,
      },
      create: {
        roomTypeId,
        date: current,
        isAvailable,
        priceOverride,
      },
    });
    current = addDays(current, 1);
  }

  await createAdminActivityLog({
    actorUserId: admin.id,
    scope: "availability-management",
    action: "upsert-room-availability-range",
    details: `Updated availability range for room ${roomTypeId}`,
    metadata: {
      roomTypeId,
      from: from.toISOString(),
      to: to.toISOString(),
      isAvailable,
      priceOverride,
    },
  });

  revalidatePath("/admin/availability");
  redirect("/admin/availability?success=Availability updated");
}

export async function adminModerateReviewAction(formData: FormData) {
  const admin = await requireUser(Role.ADMIN);
  const reviewId = String(formData.get("reviewId") ?? "");
  const status = String(formData.get("status") ?? "PENDING") as "PENDING" | "APPROVED" | "REJECTED";
  const verifiedStay = parseBooleanValue(formData.get("verifiedStay"), false);

  if (!reviewId) {
    redirect("/admin/reviews?error=Missing review id");
  }

  if (![ "PENDING", "APPROVED", "REJECTED" ].includes(status)) {
    redirect("/admin/reviews?error=Invalid review status");
  }

  await prisma.review.update({
    where: { id: reviewId },
    data: {
      status,
      verifiedStay,
    },
  });

  await createAdminActivityLog({
    actorUserId: admin.id,
    scope: "reviews-management",
    action: "moderate-review",
    details: `Set review ${reviewId} status to ${status}`,
    metadata: { reviewId, status, verifiedStay },
  });

  revalidatePath("/admin/reviews");
  redirect("/admin/reviews?success=Review updated");
}

export async function adminDeleteReviewAction(formData: FormData) {
  const admin = await requireUser(Role.ADMIN);
  const reviewId = String(formData.get("reviewId") ?? "");

  if (!reviewId) {
    redirect("/admin/reviews?error=Missing review id");
  }

  await prisma.review.delete({
    where: { id: reviewId },
  });

  await createAdminActivityLog({
    actorUserId: admin.id,
    scope: "reviews-management",
    action: "delete-review",
    details: `Deleted review ${reviewId}`,
    metadata: { reviewId },
  });

  revalidatePath("/admin/reviews");
  redirect("/admin/reviews?success=Review deleted");
}

export async function adminDeleteProviderAction(formData: FormData) {
  const admin = await requireUser(Role.ADMIN);
  const providerId = String(formData.get("providerId") ?? "");

  if (!providerId) {
    redirect("/admin/providers?error=Missing provider id");
  }

  await prisma.hotelApiProvider.delete({
    where: { id: providerId },
  });

  await createAdminActivityLog({
    actorUserId: admin.id,
    scope: "api-integrations",
    action: "delete-provider",
    details: `Deleted provider ${providerId}`,
    metadata: { providerId },
  });

  revalidatePath("/admin/providers");
  redirect("/admin/providers?success=Provider deleted");
}
