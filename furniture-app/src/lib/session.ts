import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

const COOKIE_NAME = "session";
const SECRET = process.env.SESSION_SECRET ?? "dev-only-secret-change-me";

function sign(userId: string): string {
  return createHmac("sha256", SECRET).update(userId).digest("hex");
}

function buildCookieValue(userId: string): string {
  return `${userId}.${sign(userId)}`;
}

function readUserIdFromCookieValue(value: string): string | null {
  const separatorIndex = value.lastIndexOf(".");
  if (separatorIndex === -1) return null;

  const userId = value.slice(0, separatorIndex);
  const signature = value.slice(separatorIndex + 1);
  const expected = sign(userId);

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

  return userId;
}

export async function createSession(userId: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, buildCookieValue(userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 1 week
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const value = cookieStore.get(COOKIE_NAME)?.value;
  if (!value) return null;

  const userId = readUserIdFromCookieValue(value);
  if (!userId) return null;

  return prisma.user.findUnique({ where: { id: userId } });
}
