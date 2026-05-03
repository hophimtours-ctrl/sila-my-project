import {
  HotelDataSourceMode,
  HotelStatus,
  IntegrationLogLevel,
  Prisma,
  ProviderStatus,
  Role,
} from "@prisma/client";
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";

export type NormalizedRoom = {
  externalRoomId: string;
  name: string;
  pricePerNight: number;
  maxGuests: number;
  inventory: number;
  availableInventory: number;
  isAvailable: boolean;
  photos: string[];
  cancellationPolicy: string;
};

export type NormalizedHotel = {
  externalHotelId: string;
  name: string;
  location: string;
  description: string;
  facilities: string[];
  images: string[];
  rating: number | null;
  rooms: NormalizedRoom[];
};
type RapidAuthMode = "ean-signature" | "rapidapi-key";
export type RapidBookingAttemptResult = {
  success: boolean;
  message: string;
  itineraryId?: string;
  retrieveUrl?: string;
};

const DEFAULT_ENCRYPTION_SECRET = "bookmenow-dev-hotel-api-secret-change-me";

function getEncryptionKey() {
  return createHash("sha256")
    .update(process.env.HOTEL_API_ENCRYPTION_SECRET ?? DEFAULT_ENCRYPTION_SECRET)
    .digest();
}

function toStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function toSafeString(value: unknown, fallback: string) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  return fallback;
}

function toSafeNumber(value: unknown, fallback: number) {
  const asNumber = Number(value);
  return Number.isFinite(asNumber) ? asNumber : fallback;
}
function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function objectValues(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return [];
  }

  return Object.values(input as Record<string, unknown>);
}

function toNamedValueArray(input: unknown) {
  const asStrings = toStringArray(input);
  if (asStrings.length > 0) {
    return asStrings;
  }

  return uniqueStrings(
    objectValues(input)
      .map((value) => {
        if (typeof value === "string") {
          return value.trim();
        }

        if (value && typeof value === "object") {
          return toSafeString((value as { name?: unknown }).name, "");
        }

        return "";
      })
      .filter(Boolean),
  );
}

function toImageUrlArray(input: unknown): string[] {
  if (!input) {
    return [];
  }

  if (typeof input === "string") {
    return input.trim() ? [input.trim()] : [];
  }

  if (Array.isArray(input)) {
    return uniqueStrings(input.flatMap((item) => toImageUrlArray(item)));
  }

  if (typeof input !== "object") {
    return [];
  }

  const imageObject = input as {
    href?: unknown;
    url?: unknown;
    links?: unknown;
  };

  const directUrls = [imageObject.href, imageObject.url]
    .map((value) => toSafeString(value, ""))
    .filter(Boolean);

  const linkedUrls = objectValues(imageObject.links).flatMap((value) => {
    if (typeof value === "string") {
      return value.trim() ? [value.trim()] : [];
    }

    if (!value || typeof value !== "object") {
      return [];
    }

    const href = toSafeString((value as { href?: unknown }).href, "");
    return href ? [href] : [];
  });

  if (directUrls.length > 0 || linkedUrls.length > 0) {
    return uniqueStrings([...directUrls, ...linkedUrls]);
  }

  return uniqueStrings(objectValues(imageObject).flatMap((value) => toImageUrlArray(value)));
}

function isRapidProvider(provider: { name: string; endpoint: string; hotelsPath: string }) {
  const endpoint = provider.endpoint.toLowerCase();
  const path = provider.hotelsPath.toLowerCase();
  const name = provider.name.toLowerCase();

  return (
    endpoint.includes("rapidapi.com") ||
    endpoint.includes("ean.com") ||
    endpoint.includes("expediagroup.com") ||
    name.includes("rapid") ||
    path.includes("/properties/content") ||
    path.includes("/properties/availability")
  );
}
function resolveRapidAuthMode(endpoint: string): RapidAuthMode {
  const explicitMode = (process.env.RAPID_PROVIDER_AUTH_MODE ?? "").trim().toLowerCase();
  if (explicitMode === "rapidapi") {
    return "rapidapi-key";
  }
  if (explicitMode === "ean" || explicitMode === "signature") {
    return "ean-signature";
  }

  return endpoint.toLowerCase().includes("rapidapi.com") ? "rapidapi-key" : "ean-signature";
}

function resolveRapidApiGatewayHost(endpoint: string) {
  const configuredHost = process.env.RAPIDAPI_HOST?.trim();
  if (configuredHost) {
    return configuredHost;
  }

  try {
    return new URL(endpoint).host;
  } catch {
    return "";
  }
}

function buildRapidAuthorizationHeader(apiKey: string, sharedSecret: string) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHash("sha512")
    .update(`${apiKey}${sharedSecret}${timestamp}`)
    .digest("hex");

  return `EAN APIKey=${apiKey},Signature=${signature},timestamp=${timestamp}`;
}

function addUtcDays(baseDate: Date, days: number) {
  const nextDate = new Date(baseDate);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

function formatIsoDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function normalizeRapidDateRange(options?: { checkInDate?: Date; checkOutDate?: Date }) {
  const defaultCheckIn = addUtcDays(new Date(), 1);
  const defaultCheckOut = addUtcDays(defaultCheckIn, 1);
  const checkInDate = options?.checkInDate ?? defaultCheckIn;
  const checkOutDate = options?.checkOutDate ?? defaultCheckOut;
  const rawNights = Math.ceil(
    (checkOutDate.getTime() - checkInDate.getTime()) / (24 * 60 * 60 * 1000),
  );
  const nights = Math.max(1, rawNights);

  return {
    checkIn: formatIsoDateOnly(checkInDate),
    checkOut: formatIsoDateOnly(checkOutDate),
    nights,
  };
}

function appendRapidCommercialQueryParams(searchParams: URLSearchParams) {
  const optionalSingleValueParams: Record<string, string | undefined> = {
    billing_terms: process.env.RAPID_BILLING_TERMS,
    partner_point_of_sale: process.env.RAPID_PARTNER_POINT_OF_SALE,
    payment_terms: process.env.RAPID_PAYMENT_TERMS,
    platform_name: process.env.RAPID_PLATFORM_NAME,
    travel_purpose: process.env.RAPID_TRAVEL_PURPOSE,
  };

  for (const [paramName, paramValue] of Object.entries(optionalSingleValueParams)) {
    const normalizedValue = paramValue?.trim();
    if (!normalizedValue || searchParams.has(paramName)) {
      continue;
    }
    searchParams.set(paramName, normalizedValue);
  }
}

function resolveRapidSessionId(sessionId?: string) {
  return toSafeString(sessionId, randomUUID());
}

function resolveRapidCustomerIp(required: boolean) {
  const customerIp = process.env.RAPID_CUSTOMER_IP?.trim();
  if (customerIp) {
    return customerIp;
  }

  return required ? "127.0.0.1" : "";
}

function buildRapidRequestHeaders(options: {
  apiKey: string;
  endpoint: string;
  sharedSecret?: string;
  sessionId?: string;
  requireCustomerIp?: boolean;
  contentType?: string;
}) {
  const authMode = resolveRapidAuthMode(options.endpoint);
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Accept-Encoding": "gzip",
    "User-Agent": process.env.RAPID_USER_AGENT ?? "BookMeNow/1.0",
    "Customer-Session-Id": resolveRapidSessionId(options.sessionId),
  };

  const customerIp = resolveRapidCustomerIp(Boolean(options.requireCustomerIp));
  if (customerIp) {
    headers["Customer-Ip"] = customerIp;
  }

  if (options.contentType) {
    headers["Content-Type"] = options.contentType;
  }
  if (authMode === "rapidapi-key") {
    headers["x-rapidapi-key"] = options.apiKey;
    const rapidApiHost = resolveRapidApiGatewayHost(options.endpoint);
    if (rapidApiHost) {
      headers["x-rapidapi-host"] = rapidApiHost;
    }
  } else {
    if (!options.sharedSecret) {
      throw new Error("Rapid provider shared secret is missing");
    }
    headers.Authorization = buildRapidAuthorizationHeader(options.apiKey, options.sharedSecret);
  }

  return headers;
}

async function parseApiResponsePayload(response: Response) {
  const responseText = await response.text();

  try {
    return responseText ? (JSON.parse(responseText) as unknown) : null;
  } catch {
    return responseText;
  }
}

function resolveAbsoluteRapidUrl(endpoint: string, hrefOrPath: string) {
  try {
    return new URL(hrefOrPath).toString();
  } catch {
    return new URL(hrefOrPath, endpoint).toString();
  }
}

function extractRapidPriceCheckHref(rate: unknown) {
  if (!rate || typeof rate !== "object") {
    return "";
  }

  const bedGroups = (rate as { bed_groups?: unknown }).bed_groups;
  for (const bedGroup of objectValues(bedGroups)) {
    if (!bedGroup || typeof bedGroup !== "object") {
      continue;
    }

    const href = toSafeString(
      (
        bedGroup as {
          links?: {
            price_check?: { href?: unknown };
          };
        }
      ).links?.price_check?.href,
      "",
    );
    if (href) {
      return href;
    }
  }

  return "";
}

function extractRapidBookHref(priceCheckPayload: unknown) {
  if (!priceCheckPayload || typeof priceCheckPayload !== "object") {
    return "";
  }

  return toSafeString(
    (
      priceCheckPayload as {
        links?: {
          book?: { href?: unknown };
        };
      }
    ).links?.book?.href,
    "",
  );
}

function extractRapidErrorMessage(payload: unknown, fallbackMessage: string) {
  if (!payload || typeof payload !== "object") {
    return fallbackMessage;
  }

  const message = toSafeString((payload as { message?: unknown }).message, "");
  return message || fallbackMessage;
}

function splitGuestName(fullName: string) {
  const segments = fullName
    .trim()
    .split(/\s+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  const fallbackGivenName = "Guest";
  const fallbackFamilyName = "Traveler";

  if (segments.length === 0) {
    return { givenName: fallbackGivenName, familyName: fallbackFamilyName };
  }

  if (segments.length === 1) {
    return { givenName: segments[0], familyName: fallbackFamilyName };
  }

  return {
    givenName: segments[0],
    familyName: segments.slice(1).join(" "),
  };
}

function sanitizeAffiliateReferenceId(reference: string) {
  const sanitized = reference
    .replace(/[<>()&]/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 28);

  return sanitized || randomUUID().replace(/-/g, "").slice(0, 28);
}

function normalizeRoom(rawRoom: unknown, index: number): NormalizedRoom {
  const room = typeof rawRoom === "object" && rawRoom !== null ? rawRoom : {};
  const occupancyTotal = (
    room as {
      occupancy?: {
        max_allowed?: { total?: unknown };
      };
    }
  ).occupancy?.max_allowed?.total;
  const inventory = Math.max(
    0,
    toSafeNumber(
      (room as {
        inventory?: unknown;
        totalUnits?: unknown;
        totalRooms?: unknown;
        stock?: unknown;
        availableUnits?: unknown;
      }).inventory ??
        (room as { totalUnits?: unknown }).totalUnits ??
        (room as { totalRooms?: unknown }).totalRooms ??
        (room as { stock?: unknown }).stock ??
        (room as { availableUnits?: unknown }).availableUnits,
      1,
    ),
  );
  const availableInventory = Math.max(
    0,
    toSafeNumber(
      (room as {
        availableInventory?: unknown;
        availableUnits?: unknown;
        freeUnits?: unknown;
        available?: unknown;
      }).availableInventory ??
        (room as { availableUnits?: unknown }).availableUnits ??
        (room as { freeUnits?: unknown }).freeUnits ??
        (room as { available?: unknown }).available,
      inventory,
    ),
  );

  return {
    externalRoomId: toSafeString(
      (room as { id?: unknown; externalId?: unknown; code?: unknown }).externalId ??
        (room as { id?: unknown }).id ??
        (room as { code?: unknown }).code,
      `room-${index + 1}`,
    ),
    name: toSafeString(
      (room as { name?: unknown; roomType?: unknown; title?: unknown }).name ??
        (room as { roomType?: unknown }).roomType ??
        (room as { title?: unknown }).title,
      `Room ${index + 1}`,
    ),
    pricePerNight: Math.max(
      1,
      toSafeNumber(
        (room as { price?: unknown; pricePerNight?: unknown; rate?: unknown }).pricePerNight ??
          (room as { price?: unknown }).price ??
          (room as { rate?: unknown }).rate,
        100,
      ),
    ),
    maxGuests: Math.max(
      1,
      toSafeNumber(
        (room as { maxGuests?: unknown; capacity?: unknown }).maxGuests ??
          (room as { capacity?: unknown }).capacity,
        toSafeNumber(occupancyTotal, 2),
      ),
    ),
    inventory,
    availableInventory: Math.min(inventory, availableInventory),
    isAvailable:
      toSafeNumber(
        (room as { isAvailable?: unknown; available?: unknown }).isAvailable ??
          (room as { available?: unknown }).available,
        availableInventory > 0 ? 1 : 0,
      ) > 0 && availableInventory > 0,
    photos: toImageUrlArray(
      (room as { photos?: unknown; images?: unknown; imageUrls?: unknown }).photos ??
        (room as { images?: unknown }).images ??
        (room as { imageUrls?: unknown }).imageUrls,
    ),
    cancellationPolicy: toSafeString(
      (room as { cancellationPolicy?: unknown; policy?: unknown }).cancellationPolicy ??
        (room as { policy?: unknown }).policy,
      "Cancellation policy provided by supplier",
    ),
  };
}

function resolveHotelsArray(payload: unknown) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const record = payload as Record<string, unknown>;

  if (Array.isArray(record.hotels)) {
    return record.hotels;
  }
  if (Array.isArray(record.data)) {
    return record.data;
  }
  if (Array.isArray(record.results)) {
    return record.results;
  }
  if (Array.isArray(record.items)) {
    return record.items;
  }
  const mappedObjectValues = Object.values(record).filter(
    (value) => value !== null && typeof value === "object",
  );
  if (mappedObjectValues.length > 0 && mappedObjectValues.length === Object.keys(record).length) {
    return mappedObjectValues;
  }

  return [];
}

function normalizeHotel(rawHotel: unknown, index: number): NormalizedHotel {
  const hotel = typeof rawHotel === "object" && rawHotel !== null ? rawHotel : {};
  const address =
    (hotel as {
      address?: {
        city?: unknown;
        country_code?: unknown;
      };
    }).address ?? {};
  const city = toSafeString(address.city, "");
  const countryCode = toSafeString(address.country_code, "");
  const locationFromAddress = [city, countryCode].filter(Boolean).join(", ");
  const ratings = (
    hotel as {
      ratings?: {
        property?: { rating?: unknown };
        guest?: { overall?: unknown };
      };
    }
  ).ratings;

  const rawRooms =
    (hotel as { rooms?: unknown; roomTypes?: unknown }).rooms ??
    (hotel as { roomTypes?: unknown }).roomTypes;
  const roomEntries = Array.isArray(rawRooms) ? rawRooms : objectValues(rawRooms);

  return {
    externalHotelId: toSafeString(
      (
        hotel as {
          property_id?: unknown;
          id?: unknown;
          externalId?: unknown;
          code?: unknown;
        }
      ).property_id ??
        (hotel as { externalId?: unknown }).externalId ??
        (hotel as { id?: unknown }).id ??
        (hotel as { code?: unknown }).code,
      `hotel-${index + 1}`,
    ),
    name: toSafeString(
      (hotel as { name?: unknown; title?: unknown; hotelName?: unknown }).name ??
        (hotel as { hotelName?: unknown }).hotelName ??
        (hotel as { title?: unknown }).title,
      `Imported Hotel ${index + 1}`,
    ),
    location: toSafeString(
      (hotel as { location?: unknown; city?: unknown; destination?: unknown }).location ??
        (hotel as { city?: unknown }).city ??
        (hotel as { destination?: unknown }).destination ??
        locationFromAddress,
      "Unknown location",
    ),
    description: toSafeString(
      (hotel as { description?: unknown; summary?: unknown }).description ??
        (hotel as { summary?: unknown }).summary,
      "No description provided by API.",
    ),
    facilities: toNamedValueArray(
      (hotel as { amenities?: unknown; facilities?: unknown }).amenities ??
        (hotel as { facilities?: unknown }).facilities,
    ),
    images: toImageUrlArray(
      (hotel as { images?: unknown; photos?: unknown; imageUrls?: unknown }).images ??
        (hotel as { photos?: unknown }).photos ??
        (hotel as { imageUrls?: unknown }).imageUrls,
    ),
    rating: (() => {
      const parsedRating = toSafeNumber(
        (hotel as { rating?: unknown; stars?: unknown }).rating ??
          (hotel as { stars?: unknown }).stars ??
          ratings?.property?.rating ??
          ratings?.guest?.overall,
        Number.NaN,
      );

      return Number.isFinite(parsedRating) ? parsedRating : null;
    })(),
    rooms: roomEntries.map((room, roomIndex) => normalizeRoom(room, roomIndex)),
  };
}

function resolveProviderEndpointUrl(endpoint: string, hotelsPath: string) {
  if (/^https?:\/\//i.test(hotelsPath)) {
    return hotelsPath;
  }

  const cleanedEndpoint = endpoint.endsWith("/") ? endpoint.slice(0, -1) : endpoint;
  const normalizedPath = hotelsPath.startsWith("/") ? hotelsPath : `/${hotelsPath}`;
  return `${cleanedEndpoint}${normalizedPath}`;
}

function appendRapidDefaultQueryParams(endpointUrl: string) {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(endpointUrl);
  } catch {
    return endpointUrl;
  }

  const normalizedPath = parsedUrl.pathname.toLowerCase();
  if (!normalizedPath.includes("/properties/content")) {
    return parsedUrl.toString();
  }

  if (!parsedUrl.searchParams.has("language")) {
    parsedUrl.searchParams.set("language", process.env.RAPID_LANGUAGE?.trim() || "en-US");
  }
  if (!parsedUrl.searchParams.has("supply_source")) {
    parsedUrl.searchParams.set("supply_source", process.env.RAPID_SUPPLY_SOURCE?.trim() || "expedia");
  }

  const includeFields = (process.env.RAPID_INCLUDE_FIELDS ?? "")
    .split(/[,\n]/)
    .map((value) => value.trim())
    .filter(Boolean);
  if (!parsedUrl.searchParams.has("include") && includeFields.length > 0) {
    for (const field of includeFields) {
      parsedUrl.searchParams.append("include", field);
    }
  }

  const propertyIds = (process.env.RAPID_PROPERTY_IDS ?? "")
    .split(/[,\n]/)
    .map((value) => value.trim())
    .filter(Boolean);
  if (!parsedUrl.searchParams.has("property_id") && propertyIds.length > 0) {
    for (const propertyId of propertyIds) {
      parsedUrl.searchParams.append("property_id", propertyId);
    }
  }

  appendRapidCommercialQueryParams(parsedUrl.searchParams);

  return parsedUrl.toString();
}

function buildRapidAvailabilityRequestUrl(params: {
  endpoint: string;
  propertyIds: string[];
  checkInDate?: Date;
  checkOutDate?: Date;
  occupancy?: string;
}) {
  const availabilityPath = process.env.RAPID_AVAILABILITY_PATH?.trim() || "/properties/availability";
  const endpointUrl = resolveProviderEndpointUrl(params.endpoint, availabilityPath);
  const availabilityUrl = new URL(endpointUrl);
  const dateRange = normalizeRapidDateRange({
    checkInDate: params.checkInDate,
    checkOutDate: params.checkOutDate,
  });
  const occupancy = toSafeString(params.occupancy, process.env.RAPID_OCCUPANCY?.trim() || "2");

  availabilityUrl.searchParams.set("checkin", dateRange.checkIn);
  availabilityUrl.searchParams.set("checkout", dateRange.checkOut);
  availabilityUrl.searchParams.set("currency", process.env.RAPID_CURRENCY?.trim() || "USD");
  availabilityUrl.searchParams.set("country_code", process.env.RAPID_COUNTRY_CODE?.trim() || "US");
  availabilityUrl.searchParams.set("language", process.env.RAPID_LANGUAGE?.trim() || "en-US");
  availabilityUrl.searchParams.set("rate_plan_count", process.env.RAPID_RATE_PLAN_COUNT?.trim() || "1");
  availabilityUrl.searchParams.set("sales_channel", process.env.RAPID_SALES_CHANNEL?.trim() || "website");
  availabilityUrl.searchParams.set(
    "sales_environment",
    process.env.RAPID_SALES_ENVIRONMENT?.trim() || "hotel_only",
  );
  availabilityUrl.searchParams.append("occupancy", occupancy);
  for (const propertyId of params.propertyIds) {
    availabilityUrl.searchParams.append("property_id", propertyId);
  }
  appendRapidCommercialQueryParams(availabilityUrl.searchParams);

  return {
    url: availabilityUrl.toString(),
    nights: dateRange.nights,
  };
}

function extractRapidRateTotalForStay(rate: unknown) {
  if (!rate || typeof rate !== "object") {
    return null;
  }

  const occupancyPricing = (rate as { occupancy_pricing?: unknown }).occupancy_pricing;
  for (const pricingEntry of objectValues(occupancyPricing)) {
    if (!pricingEntry || typeof pricingEntry !== "object") {
      continue;
    }

    const totals = (pricingEntry as { totals?: unknown }).totals;
    if (!totals || typeof totals !== "object") {
      continue;
    }

    const inclusive = (totals as { inclusive?: unknown }).inclusive;
    if (!inclusive || typeof inclusive !== "object") {
      continue;
    }

    const requestCurrency = (inclusive as { request_currency?: unknown }).request_currency;
    const billableCurrency = (inclusive as { billable_currency?: unknown }).billable_currency;
    const requestValue = toSafeNumber(
      (requestCurrency as { value?: unknown } | undefined)?.value,
      Number.NaN,
    );
    if (Number.isFinite(requestValue) && requestValue > 0) {
      return requestValue;
    }

    const billableValue = toSafeNumber(
      (billableCurrency as { value?: unknown } | undefined)?.value,
      Number.NaN,
    );
    if (Number.isFinite(billableValue) && billableValue > 0) {
      return billableValue;
    }
  }

  return null;
}

function mergeRapidAvailabilityIntoHotels(
  hotels: NormalizedHotel[],
  availabilityPayload: unknown,
  nights: number,
) {
  if (!Array.isArray(availabilityPayload) || availabilityPayload.length === 0) {
    return hotels;
  }

  const availabilityByProperty = new Map<string, unknown>();
  for (const propertyEntry of availabilityPayload) {
    if (!propertyEntry || typeof propertyEntry !== "object") {
      continue;
    }

    const propertyId = toSafeString((propertyEntry as { property_id?: unknown }).property_id, "");
    if (!propertyId) {
      continue;
    }
    availabilityByProperty.set(propertyId, propertyEntry);
  }

  return hotels.map((hotel) => {
    const propertyAvailability = availabilityByProperty.get(hotel.externalHotelId);
    if (!propertyAvailability || typeof propertyAvailability !== "object") {
      return hotel;
    }

    const availabilityRooms = Array.isArray((propertyAvailability as { rooms?: unknown }).rooms)
      ? ((propertyAvailability as { rooms?: unknown }).rooms as unknown[])
      : [];
    if (availabilityRooms.length === 0) {
      return hotel;
    }

    const availabilityByRoom = new Map<string, unknown>();
    for (const roomEntry of availabilityRooms) {
      if (!roomEntry || typeof roomEntry !== "object") {
        continue;
      }
      const roomId = toSafeString((roomEntry as { id?: unknown }).id, "");
      if (!roomId) {
        continue;
      }
      availabilityByRoom.set(roomId, roomEntry);
    }

    return {
      ...hotel,
      rooms: hotel.rooms.map((room) => {
        const availabilityRoom = availabilityByRoom.get(room.externalRoomId);
        if (!availabilityRoom || typeof availabilityRoom !== "object") {
          return room;
        }

        const rates = Array.isArray((availabilityRoom as { rates?: unknown }).rates)
          ? ((availabilityRoom as { rates?: unknown }).rates as unknown[])
          : [];
        if (rates.length === 0) {
          return room;
        }

        const preferredRate =
          rates.find(
            (rate) =>
              toSafeString((rate as { status?: unknown }).status, "").toLowerCase() === "available",
          ) ?? rates[0];
        const availableRooms = Math.max(
          0,
          toSafeNumber((preferredRate as { available_rooms?: unknown }).available_rooms, room.availableInventory),
        );
        const status = toSafeString((preferredRate as { status?: unknown }).status, "");
        const totalPrice = extractRapidRateTotalForStay(preferredRate);
        const nextPricePerNight =
          totalPrice !== null && totalPrice > 0 ? Math.max(1, totalPrice / Math.max(1, nights)) : room.pricePerNight;
        const isRefundable = Boolean((preferredRate as { refundable?: unknown }).refundable);

        return {
          ...room,
          pricePerNight: nextPricePerNight,
          inventory: Math.max(room.inventory, availableRooms),
          availableInventory: Math.min(Math.max(room.inventory, availableRooms), availableRooms),
          isAvailable: status === "available" && availableRooms > 0,
          cancellationPolicy: isRefundable
            ? "Refundable rate provided by Rapid"
            : room.cancellationPolicy,
        };
      }),
    };
  });
}

async function fetchRapidAvailabilityForHotels(params: {
  provider: {
    id: string;
    endpoint: string;
    apiKeyEncrypted: string;
    apiSecretEncrypted: string | null;
  };
  propertyIds: string[];
  checkInDate?: Date;
  checkOutDate?: Date;
  occupancy?: string;
}) {
  if (params.propertyIds.length === 0) {
    return { availabilityPayload: [] as unknown[], nights: 1 };
  }
  const authMode = resolveRapidAuthMode(params.provider.endpoint);
  if (authMode === "ean-signature" && !params.provider.apiSecretEncrypted) {
    return { availabilityPayload: [] as unknown[], nights: 1 };
  }

  const apiKey = decryptApiKey(params.provider.apiKeyEncrypted);
  const sharedSecret = params.provider.apiSecretEncrypted
    ? decryptApiKey(params.provider.apiSecretEncrypted)
    : undefined;
  const uniquePropertyIds = Array.from(new Set(params.propertyIds.filter(Boolean)));
  const sessionId = randomUUID();
  const allAvailability: unknown[] = [];
  let resolvedNights = 1;

  for (let start = 0; start < uniquePropertyIds.length; start += 250) {
    const chunk = uniquePropertyIds.slice(start, start + 250);
    const availabilityRequest = buildRapidAvailabilityRequestUrl({
      endpoint: params.provider.endpoint,
      propertyIds: chunk,
      checkInDate: params.checkInDate,
      checkOutDate: params.checkOutDate,
      occupancy: params.occupancy,
    });
    resolvedNights = availabilityRequest.nights;

    const response = await fetch(availabilityRequest.url, {
      headers: buildRapidRequestHeaders({
        apiKey,
        endpoint: params.provider.endpoint,
        sharedSecret,
        sessionId,
        requireCustomerIp: false,
      }),
      cache: "no-store",
    });
    const payload = await parseApiResponsePayload(response);

    if (!response.ok) {
      await logProviderEvent(
        params.provider.id,
        IntegrationLogLevel.WARNING,
        "rapid-availability",
        `Rapid availability request failed (${response.status})`,
        {
          statusCode: response.status,
          propertyCount: chunk.length,
        },
      );
      continue;
    }

    if (Array.isArray(payload)) {
      allAvailability.push(...payload);
    }
  }

  return {
    availabilityPayload: allAvailability,
    nights: resolvedNights,
  };
}

export function encryptApiKey(apiKey: string) {
  const iv = randomBytes(12);
  const key = getEncryptionKey();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptApiKey(payload: string) {
  const [ivBase64, tagBase64, encryptedBase64] = payload.split(":");
  if (!ivBase64 || !tagBase64 || !encryptedBase64) {
    throw new Error("Invalid encrypted API key payload");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivBase64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagBase64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedBase64, "base64")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

export function maskApiKey(apiKey: string) {
  if (apiKey.length <= 4) {
    return "*".repeat(apiKey.length);
  }

  return `${apiKey.slice(0, 2)}${"*".repeat(Math.max(4, apiKey.length - 4))}${apiKey.slice(-2)}`;
}

export async function logProviderEvent(
  providerId: string,
  level: IntegrationLogLevel,
  action: string,
  message: string,
  metadata?: Prisma.InputJsonValue,
) {
  await prisma.hotelApiSyncLog.create({
    data: {
      providerId,
      level,
      action,
      message,
      metadata,
    },
  });
}

async function fetchProviderHotelPayload(providerId: string) {
  const provider = await prisma.hotelApiProvider.findUnique({
    where: { id: providerId },
  });

  if (!provider) {
    throw new Error("Provider not found");
  }

  const apiKey = decryptApiKey(provider.apiKeyEncrypted);
  let endpointUrl = resolveProviderEndpointUrl(provider.endpoint, provider.hotelsPath);
  let requestHeaders: Record<string, string> = {
    Accept: "application/json",
  };

  if (isRapidProvider(provider)) {
    const authMode = resolveRapidAuthMode(provider.endpoint);
    if (authMode === "ean-signature" && !provider.apiSecretEncrypted) {
      throw new Error("Rapid provider requires a shared secret");
    }
    endpointUrl = appendRapidDefaultQueryParams(endpointUrl);
    const sharedSecret = provider.apiSecretEncrypted
      ? decryptApiKey(provider.apiSecretEncrypted)
      : undefined;
    requestHeaders = buildRapidRequestHeaders({
      apiKey,
      endpoint: provider.endpoint,
      sharedSecret,
      sessionId: randomUUID(),
      requireCustomerIp: false,
    });
  } else {
    requestHeaders.Authorization = `Bearer ${apiKey}`;
    requestHeaders["x-api-key"] = apiKey;
  }
  const response = await fetch(endpointUrl, {
    headers: requestHeaders,
    cache: "no-store",
  });
  const payload = await parseApiResponsePayload(response);

  return { provider, response, payload };
}

export async function fetchNormalizedHotelsForProvider(options: {
  providerId: string;
  checkInDate?: Date;
  checkOutDate?: Date;
  guests?: number;
  includeAvailability?: boolean;
}) {
  const { provider, response, payload } = await fetchProviderHotelPayload(options.providerId);

  if (!response.ok) {
    throw new Error(`Provider fetch failed (${response.status})`);
  }

  const rawHotels = resolveHotelsArray(payload);
  let normalizedHotels = rawHotels.map((item, index) => normalizeHotel(item, index));
  const shouldIncludeAvailability = options.includeAvailability !== false;

  if (shouldIncludeAvailability && isRapidProvider(provider) && normalizedHotels.length > 0) {
    const rapidAvailability = await fetchRapidAvailabilityForHotels({
      provider,
      propertyIds: normalizedHotels.map((hotel) => hotel.externalHotelId),
      checkInDate: options.checkInDate,
      checkOutDate: options.checkOutDate,
      occupancy:
        typeof options.guests === "number" && Number.isFinite(options.guests) && options.guests > 0
          ? String(Math.floor(options.guests))
          : undefined,
    });
    normalizedHotels = mergeRapidAvailabilityIntoHotels(
      normalizedHotels,
      rapidAvailability.availabilityPayload,
      rapidAvailability.nights,
    );
  }

  return {
    provider: {
      id: provider.id,
      name: provider.name,
      endpoint: provider.endpoint,
      hotelsPath: provider.hotelsPath,
    },
    hotels: normalizedHotels,
  };
}

export async function testHotelProviderConnection(providerId: string) {
  try {
    const { provider, response, payload } = await fetchProviderHotelPayload(providerId);
    const hotels = resolveHotelsArray(payload);

    if (!response.ok) {
      const message = `Provider test failed (${response.status})`;
      await prisma.hotelApiProvider.update({
        where: { id: provider.id },
        data: {
          status: ProviderStatus.ERROR,
          lastError: message,
          lastTestedAt: new Date(),
        },
      });
      await logProviderEvent(provider.id, IntegrationLogLevel.ERROR, "test-connection", message, {
        statusCode: response.status,
      });

      return { success: false, message };
    }

    await prisma.hotelApiProvider.update({
      where: { id: provider.id },
      data: {
        status: provider.enabled ? ProviderStatus.ACTIVE : ProviderStatus.DISABLED,
        lastError: null,
        lastTestedAt: new Date(),
      },
    });
    await logProviderEvent(
      provider.id,
      IntegrationLogLevel.INFO,
      "test-connection",
      `Connection successful. Received ${hotels.length} hotel records.`,
    );

    return {
      success: true,
      message: `Connection successful. Received ${hotels.length} hotel records.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown connection error";
    await prisma.hotelApiProvider.update({
      where: { id: providerId },
      data: {
        status: ProviderStatus.ERROR,
        lastError: message,
        lastTestedAt: new Date(),
      },
    });
    await logProviderEvent(providerId, IntegrationLogLevel.ERROR, "test-connection", message);

    return { success: false, message };
  }
}

async function resolveDefaultOwnerId() {
  const admin = await prisma.user.findFirst({ where: { role: Role.ADMIN } });
  if (admin) {
    return admin.id;
  }

  const owner = await prisma.user.findFirst({ where: { role: Role.OWNER } });
  if (owner) {
    return owner.id;
  }

  const fallbackUser = await prisma.user.findFirst();
  if (!fallbackUser) {
    throw new Error("Cannot import hotels because there are no users in the system");
  }

  return fallbackUser.id;
}

export async function syncHotelProviderData(providerId: string, trigger: "manual" | "auto" = "manual") {
  const provider = await prisma.hotelApiProvider.findUnique({
    where: { id: providerId },
  });

  if (!provider) {
    return { success: false, message: "Provider not found", importedCount: 0 };
  }

  if (!provider.enabled) {
    await prisma.hotelApiProvider.update({
      where: { id: provider.id },
      data: { status: ProviderStatus.DISABLED },
    });
    await logProviderEvent(
      provider.id,
      IntegrationLogLevel.WARNING,
      "sync-skipped",
      "Sync skipped because provider is disabled",
    );
    return { success: false, message: "Provider is disabled", importedCount: 0 };
  }

  try {
    const { response, payload } = await fetchProviderHotelPayload(provider.id);
    if (!response.ok) {
      const message = `Sync failed with status ${response.status}`;
      await prisma.hotelApiProvider.update({
        where: { id: provider.id },
        data: {
          status: ProviderStatus.ERROR,
          lastError: message,
          lastRefreshedAt: new Date(),
        },
      });
      await logProviderEvent(provider.id, IntegrationLogLevel.ERROR, "sync", message, {
        trigger,
        statusCode: response.status,
      });
      return { success: false, message, importedCount: 0 };
    }

    const rawHotels = resolveHotelsArray(payload);
    let normalizedHotels = rawHotels.map((item, index) => normalizeHotel(item, index));
    if (isRapidProvider(provider) && normalizedHotels.length > 0) {
      const rapidAvailability = await fetchRapidAvailabilityForHotels({
        provider,
        propertyIds: normalizedHotels.map((hotel) => hotel.externalHotelId),
      });
      normalizedHotels = mergeRapidAvailabilityIntoHotels(
        normalizedHotels,
        rapidAvailability.availabilityPayload,
        rapidAvailability.nights,
      );
    }
    const ownerId = await resolveDefaultOwnerId();
    let importedCount = 0;

    for (const normalizedHotel of normalizedHotels) {
      const existingHotel = await prisma.hotel.findFirst({
        where: {
          providerId: provider.id,
          externalHotelId: normalizedHotel.externalHotelId,
        },
      });

      let hotelId = existingHotel?.id;

      if (existingHotel) {
        const shouldPreserveManual =
          existingHotel.manualOverride || existingHotel.dataSourceMode === HotelDataSourceMode.MANUAL;

        await prisma.hotel.update({
          where: { id: existingHotel.id },
          data: {
            ...(shouldPreserveManual
              ? {}
              : {
                  name: normalizedHotel.name,
                  location: normalizedHotel.location,
                  description: normalizedHotel.description,
                  facilities: normalizedHotel.facilities,
                  images: normalizedHotel.images,
                }),
            rating: normalizedHotel.rating,
            status: HotelStatus.APPROVED,
            providerId: provider.id,
            externalHotelId: normalizedHotel.externalHotelId,
            dataSourceMode: shouldPreserveManual
              ? HotelDataSourceMode.HYBRID
              : existingHotel.dataSourceMode === HotelDataSourceMode.MANUAL
                ? HotelDataSourceMode.HYBRID
                : HotelDataSourceMode.API,
            lastImportedAt: new Date(),
          },
        });
      } else {
        const createdHotel = await prisma.hotel.create({
          data: {
            ownerId,
            providerId: provider.id,
            externalHotelId: normalizedHotel.externalHotelId,
            name: normalizedHotel.name,
            location: normalizedHotel.location,
            description: normalizedHotel.description,
            facilities: normalizedHotel.facilities,
            images: normalizedHotel.images,
            rating: normalizedHotel.rating,
            dataSourceMode: HotelDataSourceMode.API,
            status: HotelStatus.APPROVED,
            lastImportedAt: new Date(),
          },
        });

        hotelId = createdHotel.id;
      }

      if (!hotelId) {
        continue;
      }

      for (const room of normalizedHotel.rooms) {
        const existingRoom = await prisma.roomType.findFirst({
          where: {
            hotelId,
            externalRoomId: room.externalRoomId,
          },
        });

        if (existingRoom) {
          await prisma.roomType.update({
            where: { id: existingRoom.id },
            data: {
              name: room.name,
              pricePerNight: room.pricePerNight,
              maxGuests: room.maxGuests,
              inventory: room.inventory,
              availableInventory: room.availableInventory,
              isAvailable: room.isAvailable,
              photos: room.photos,
              cancellationPolicy: room.cancellationPolicy,
            },
          });
        } else {
          await prisma.roomType.create({
            data: {
              hotelId,
              externalRoomId: room.externalRoomId,
              name: room.name,
              pricePerNight: room.pricePerNight,
              maxGuests: room.maxGuests,
              inventory: room.inventory,
              availableInventory: room.availableInventory,
              isAvailable: room.isAvailable,
              photos: room.photos,
              cancellationPolicy: room.cancellationPolicy,
            },
          });
        }
      }

      importedCount += 1;
    }

    await prisma.hotelApiProvider.update({
      where: { id: provider.id },
      data: {
        status: ProviderStatus.ACTIVE,
        lastError: null,
        lastRefreshedAt: new Date(),
      },
    });
    await logProviderEvent(
      provider.id,
      IntegrationLogLevel.INFO,
      "sync",
      `Sync complete: imported ${importedCount} hotels`,
      { trigger, importedCount },
    );

    return {
      success: true,
      message: `Sync complete: imported ${importedCount} hotels`,
      importedCount,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sync error";
    await prisma.hotelApiProvider.update({
      where: { id: provider.id },
      data: {
        status: ProviderStatus.ERROR,
        lastError: message,
        lastRefreshedAt: new Date(),
      },
    });
    await logProviderEvent(provider.id, IntegrationLogLevel.ERROR, "sync", message, { trigger });

    return { success: false, message, importedCount: 0 };
  }
}

export async function createRapidBookingForRoom(params: {
  providerId: string;
  externalHotelId: string;
  externalRoomId: string;
  checkInDate: Date;
  checkOutDate: Date;
  guests: number;
  customerEmail: string;
  customerName: string;
  affiliateReferenceId: string;
}) {
  const provider = await prisma.hotelApiProvider.findUnique({
    where: { id: params.providerId },
  });

  if (!provider) {
    return {
      success: false,
      message: "Rapid provider not found",
    } satisfies RapidBookingAttemptResult;
  }

  if (!isRapidProvider(provider)) {
    return {
      success: false,
      message: "Selected provider is not a Rapid provider",
    } satisfies RapidBookingAttemptResult;
  }

  const authMode = resolveRapidAuthMode(provider.endpoint);
  if (authMode === "ean-signature" && !provider.apiSecretEncrypted) {
    return {
      success: false,
      message: "Rapid provider shared secret is missing",
    } satisfies RapidBookingAttemptResult;
  }

  const apiKey = decryptApiKey(provider.apiKeyEncrypted);
  const sharedSecret = provider.apiSecretEncrypted
    ? decryptApiKey(provider.apiSecretEncrypted)
    : undefined;
  const sessionId = randomUUID();
  const occupancy = String(Math.max(1, params.guests));
  const availabilityRequest = buildRapidAvailabilityRequestUrl({
    endpoint: provider.endpoint,
    propertyIds: [params.externalHotelId],
    checkInDate: params.checkInDate,
    checkOutDate: params.checkOutDate,
    occupancy,
  });
  const availabilityResponse = await fetch(availabilityRequest.url, {
    headers: buildRapidRequestHeaders({
      apiKey,
      endpoint: provider.endpoint,
      sharedSecret,
      sessionId,
      requireCustomerIp: false,
    }),
    cache: "no-store",
  });
  const availabilityPayload = await parseApiResponsePayload(availabilityResponse);

  if (!availabilityResponse.ok) {
    const message = extractRapidErrorMessage(
      availabilityPayload,
      `Rapid availability failed (${availabilityResponse.status})`,
    );
    await logProviderEvent(provider.id, IntegrationLogLevel.ERROR, "rapid-booking", message, {
      stage: "availability",
      statusCode: availabilityResponse.status,
      externalHotelId: params.externalHotelId,
      externalRoomId: params.externalRoomId,
    });
    return { success: false, message };
  }

  const propertyAvailability = Array.isArray(availabilityPayload)
    ? availabilityPayload.find(
        (property) =>
          toSafeString((property as { property_id?: unknown }).property_id, "") ===
          params.externalHotelId,
      )
    : null;
  if (!propertyAvailability || typeof propertyAvailability !== "object") {
    return {
      success: false,
      message: "Rapid availability returned no matching property",
    };
  }

  const roomEntries = Array.isArray((propertyAvailability as { rooms?: unknown }).rooms)
    ? ((propertyAvailability as { rooms?: unknown }).rooms as unknown[])
    : [];
  const matchingRoom =
    roomEntries.find(
      (room) => toSafeString((room as { id?: unknown }).id, "") === params.externalRoomId,
    ) ?? roomEntries[0];
  if (!matchingRoom || typeof matchingRoom !== "object") {
    return {
      success: false,
      message: "Rapid availability returned no matching room",
    };
  }

  const rates = Array.isArray((matchingRoom as { rates?: unknown }).rates)
    ? ((matchingRoom as { rates?: unknown }).rates as unknown[])
    : [];
  const selectedRate =
    rates.find((rate) => toSafeString((rate as { status?: unknown }).status, "") === "available") ??
    rates[0];
  if (!selectedRate) {
    return {
      success: false,
      message: "Rapid room is not available for selected dates",
    };
  }

  const priceCheckHref = extractRapidPriceCheckHref(selectedRate);
  if (!priceCheckHref) {
    return {
      success: false,
      message: "Rapid price-check link is missing",
    };
  }

  const priceCheckUrl = resolveAbsoluteRapidUrl(provider.endpoint, priceCheckHref);
  const priceCheckResponse = await fetch(priceCheckUrl, {
    headers: buildRapidRequestHeaders({
      apiKey,
      endpoint: provider.endpoint,
      sharedSecret,
      sessionId,
      requireCustomerIp: false,
    }),
    cache: "no-store",
  });
  const priceCheckPayload = await parseApiResponsePayload(priceCheckResponse);

  if (!priceCheckResponse.ok) {
    const message = extractRapidErrorMessage(
      priceCheckPayload,
      `Rapid price check failed (${priceCheckResponse.status})`,
    );
    await logProviderEvent(provider.id, IntegrationLogLevel.ERROR, "rapid-booking", message, {
      stage: "price-check",
      statusCode: priceCheckResponse.status,
      externalHotelId: params.externalHotelId,
      externalRoomId: params.externalRoomId,
    });
    return { success: false, message };
  }

  const bookHref = extractRapidBookHref(priceCheckPayload);
  if (!bookHref) {
    return {
      success: false,
      message: "Rapid booking link missing after price check",
    };
  }

  const { givenName, familyName } = splitGuestName(params.customerName);
  const billingGivenName = process.env.RAPID_BILLING_GIVEN_NAME?.trim() || givenName;
  const billingFamilyName = process.env.RAPID_BILLING_FAMILY_NAME?.trim() || familyName;
  const bookingUrl = resolveAbsoluteRapidUrl(provider.endpoint, bookHref);
  const paymentTypeInput = (process.env.RAPID_PAYMENT_TYPE ?? "").trim().toLowerCase();
  const allowedPaymentTypes = new Set([
    "affiliate_collect",
    "customer_card",
    "corporate_card",
    "virtual_card",
  ]);
  const paymentType = allowedPaymentTypes.has(paymentTypeInput)
    ? paymentTypeInput
    : "affiliate_collect";
  const paymentPayload: Record<string, unknown> = {
    type: paymentType,
    billing_contact: {
      given_name: billingGivenName,
      family_name: billingFamilyName,
      address: {
        line_1: process.env.RAPID_BILLING_ADDRESS_LINE1?.trim() || undefined,
        line_2: process.env.RAPID_BILLING_ADDRESS_LINE2?.trim() || undefined,
        line_3: process.env.RAPID_BILLING_ADDRESS_LINE3?.trim() || undefined,
        city: process.env.RAPID_BILLING_CITY?.trim() || undefined,
        state_province_code: process.env.RAPID_BILLING_STATE?.trim() || undefined,
        postal_code: process.env.RAPID_BILLING_POSTAL_CODE?.trim() || undefined,
        country_code: process.env.RAPID_BILLING_COUNTRY_CODE?.trim() || "US",
      },
    },
  };

  if (paymentType !== "affiliate_collect") {
    const cardNumber = process.env.RAPID_PAYMENT_CARD_NUMBER?.trim();
    const securityCode = process.env.RAPID_PAYMENT_CARD_CVC?.trim();
    const expirationMonth = process.env.RAPID_PAYMENT_CARD_EXP_MONTH?.trim();
    const expirationYear = process.env.RAPID_PAYMENT_CARD_EXP_YEAR?.trim();
    if (!cardNumber || !securityCode || !expirationMonth || !expirationYear) {
      return {
        success: false,
        message:
          "Rapid card payment type selected but card environment variables are missing",
      };
    }
    paymentPayload.number = cardNumber;
    paymentPayload.security_code = securityCode;
    paymentPayload.expiration_month = expirationMonth;
    paymentPayload.expiration_year = expirationYear;
  }

  const bookingRequestBody = {
    affiliate_reference_id: sanitizeAffiliateReferenceId(params.affiliateReferenceId),
    hold: process.env.RAPID_BOOKING_HOLD?.trim() !== "false",
    email: params.customerEmail,
    phone: {
      country_code: process.env.RAPID_PHONE_COUNTRY_CODE?.trim() || "1",
      area_code: process.env.RAPID_PHONE_AREA_CODE?.trim() || undefined,
      number: process.env.RAPID_PHONE_NUMBER?.trim() || "5550077",
    },
    rooms: [
      {
        given_name: givenName,
        family_name: familyName,
        smoking: false,
      },
    ],
    payments: [paymentPayload],
  };
  const bookingResponse = await fetch(bookingUrl, {
    method: "POST",
    headers: buildRapidRequestHeaders({
      apiKey,
      endpoint: provider.endpoint,
      sharedSecret,
      sessionId,
      requireCustomerIp: true,
      contentType: "application/json",
    }),
    body: JSON.stringify(bookingRequestBody),
    cache: "no-store",
  });
  const bookingPayload = await parseApiResponsePayload(bookingResponse);

  if (!bookingResponse.ok) {
    const message = extractRapidErrorMessage(
      bookingPayload,
      `Rapid booking failed (${bookingResponse.status})`,
    );
    await logProviderEvent(provider.id, IntegrationLogLevel.ERROR, "rapid-booking", message, {
      stage: "create-itinerary",
      statusCode: bookingResponse.status,
      externalHotelId: params.externalHotelId,
      externalRoomId: params.externalRoomId,
    });
    return { success: false, message };
  }

  const itineraryId = toSafeString(
    (bookingPayload as { itinerary_id?: unknown } | null)?.itinerary_id,
    "",
  );
  const retrieveUrl = toSafeString(
    (
      bookingPayload as {
        links?: {
          retrieve?: {
            href?: unknown;
          };
        };
      } | null
    )?.links?.retrieve?.href,
    "",
  );
  const normalizedRetrieveUrl = retrieveUrl
    ? resolveAbsoluteRapidUrl(provider.endpoint, retrieveUrl)
    : undefined;

  await logProviderEvent(
    provider.id,
    IntegrationLogLevel.INFO,
    "rapid-booking",
    itineraryId
      ? `Rapid itinerary created: ${itineraryId}`
      : "Rapid booking request accepted without itinerary id",
    {
      stage: "create-itinerary",
      externalHotelId: params.externalHotelId,
      externalRoomId: params.externalRoomId,
      itineraryId: itineraryId || null,
    },
  );

  return {
    success: Boolean(itineraryId),
    message: itineraryId
      ? "Rapid itinerary created successfully"
      : "Rapid booking response did not include itinerary id",
    itineraryId: itineraryId || undefined,
    retrieveUrl: normalizedRetrieveUrl,
  };
}

export async function runAutoRefreshForProviders() {
  const now = Date.now();
  const providers = await prisma.hotelApiProvider.findMany({
    where: {
      enabled: true,
      autoRefreshEnabled: true,
    },
  });

  for (const provider of providers) {
    const lastRefresh = provider.lastRefreshedAt?.getTime() ?? 0;
    const intervalMs = provider.refreshIntervalMinutes * 60 * 1000;
    const isDue = lastRefresh === 0 || now - lastRefresh >= intervalMs;

    if (isDue) {
      await syncHotelProviderData(provider.id, "auto");
    }
  }
}
