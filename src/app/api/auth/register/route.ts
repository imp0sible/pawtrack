import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signSession, sessionCookie } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { normalizePhone, isValidPhone } from "@/lib/phone";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { evaluateAchievements } from "@/lib/achievements";

function fail(error: string, field?: string, status = 400) {
  return NextResponse.json({ error, field }, { status });
}

export async function POST(req: Request) {
  if (!rateLimit(`register:${clientIp(req)}`, 5, 60_000)) {
    return fail("Too many attempts. Try again in a minute.", undefined, 429);
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return fail("Invalid request");
  }

  const name = String(body.name ?? "").trim();
  const rawPhone = String(body.phone ?? "").trim();
  const password = String(body.password ?? "");
  const rawUsername = String(body.username ?? "").trim().replace(/^@/, "");

  if (!name) return fail("Please enter your name.", "name");
  if (!isValidPhone(rawPhone)) return fail("Enter a valid phone number.", "phone");
  if (password.length < 6) return fail("Password must be at least 6 characters.", "password");
  if (rawUsername && !/^[a-zA-Z0-9_]{3,32}$/.test(rawUsername)) {
    return fail("Username must be 3–32 letters, numbers or underscores.", "username");
  }

  const phone = normalizePhone(rawPhone);
  const username = rawUsername || null;

  if (await prisma.user.findUnique({ where: { phone } })) {
    return fail("An account with this phone already exists.", "phone", 409);
  }
  if (username && (await prisma.user.findUnique({ where: { username } }))) {
    return fail("That username is taken.", "username", 409);
  }

  const user = await prisma.user.create({
    data: {
      phone,
      username,
      firstName: name,
      passwordHash: hashPassword(password),
      settings: { create: {} },
    },
  });

  // New accounts created during the alpha earn the Alpha Pioneer badge.
  try {
    await evaluateAchievements(user.id);
  } catch {}

  const token = await signSession(user.id);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookie.name, token, { ...sessionCookie.options, maxAge: sessionCookie.maxAge });
  return res;
}
