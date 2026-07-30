import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signSession, sessionCookie } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { normalizePhone } from "@/lib/phone";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { evaluateAchievements } from "@/lib/achievements";

export async function POST(req: Request) {
  if (!rateLimit(`login:${clientIp(req)}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many attempts. Try again in a minute." }, { status: 429 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const identifier = String(body.identifier ?? "").trim();
  const password = String(body.password ?? "");
  if (!identifier || !password) {
    return NextResponse.json({ error: "Enter your phone/username and password." }, { status: 400 });
  }

  // The identifier may be a phone number or a username (with or without @).
  const asUsername = identifier.replace(/^@/, "");
  const asPhone = normalizePhone(identifier);

  const user = await prisma.user.findFirst({
    where: { OR: [{ phone: asPhone }, { username: asUsername }] },
  });

  const invalid = NextResponse.json(
    { error: "Invalid phone/username or password." },
    { status: 401 }
  );
  if (!user || !verifyPassword(password, user.passwordHash)) return invalid;

  // Correct credentials, but the account is banned — say so plainly instead of
  // signing them into a dead end.
  if (user.bannedAt) {
    return NextResponse.json(
      { error: user.banReason ? `This account has been banned: ${user.banReason}` : "This account has been banned." },
      { status: 403 }
    );
  }

  // Best-effort: grant time-limited badges (e.g. Alpha Pioneer) on sign-in.
  // Never let this block or fail the login.
  try {
    await evaluateAchievements(user.id);
  } catch {}

  const token = await signSession(user.id);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookie.name, token, { ...sessionCookie.options, maxAge: sessionCookie.maxAge });
  return res;
}
