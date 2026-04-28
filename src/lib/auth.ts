import { Role } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";

const COOKIE_NAME = "bookmenow_session";
export const PROFILE_IMAGE_COOKIE_NAME = "bookmenow_profile_image";
const SESSION_DAYS = 7;

function normalizeProfileImageUrl(profileImageUrl?: string | null) {
  const normalizedUrl = profileImageUrl?.trim();
  if (!normalizedUrl) {
    return null;
  }

  if (!/^https?:\/\//i.test(normalizedUrl)) {
    return null;
  }

  return normalizedUrl;
}

export async function setSessionProfileImage(profileImageUrl?: string | null) {
  const cookieStore = await cookies();
  const normalizedUrl = normalizeProfileImageUrl(profileImageUrl);

  if (!normalizedUrl) {
    cookieStore.delete(PROFILE_IMAGE_COOKIE_NAME);
    return;
  }

  cookieStore.set(PROFILE_IMAGE_COOKIE_NAME, normalizedUrl, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000),
    path: "/",
  });
}

export async function createSession(userId: string) {
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }

  cookieStore.delete(COOKIE_NAME);
  cookieStore.delete(PROFILE_IMAGE_COOKIE_NAME);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date() || session.user.blocked) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } });
    }
    return null;
  }

  return session.user;
}

export async function requireUser(role?: Role) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (role && user.role !== role) {
    redirect("/");
  }

  return user;
}
