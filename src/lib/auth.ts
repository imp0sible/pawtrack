import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { signSessionToken, verifySessionToken } from "@/lib/jwt";

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "ld_session";
const SESSION_DAYS = 30;

export function signSession(userId: string): Promise<string> {
  return signSessionToken(userId, `${SESSION_DAYS}d`);
}

export function verifySession(token: string): Promise<string | null> {
  return verifySessionToken(token);
}

export const sessionCookie = {
  name: COOKIE_NAME,
  maxAge: SESSION_DAYS * 24 * 60 * 60,
  options: {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  },
};

// Short-lived cookie holding a "reset" grant (issued once Telegram confirmed the
// account), consumed by the reset-confirm endpoint. Not a login session.
export const resetGrantCookie = {
  name: "ld_reset",
  maxAge: 10 * 60, // 10 minutes
  options: {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  },
};

// Reads the session cookie and returns the current user (with settings), or null.
export async function getSessionUser() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const uid = await verifySession(token);
  if (!uid) return null;
  return prisma.user.findUnique({
    where: { id: uid },
    include: { settings: true },
  });
}

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;
