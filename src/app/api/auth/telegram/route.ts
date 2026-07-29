import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signSession, sessionCookie } from "@/lib/auth";
import { verifyTelegramAuth } from "@/lib/telegram";
import { evaluateAchievements } from "@/lib/achievements";

// Canonical origin for redirects — reliable behind the reverse proxy, where the
// request's own host/protocol may be the internal http://localhost:3000.
function base(req: Request): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
}

async function upsertTelegramUser(v: NonNullable<ReturnType<typeof verifyTelegramAuth>>) {
  const telegramId = String(v.id);
  return prisma.user.upsert({
    where: { telegramId },
    create: {
      telegramId,
      username: v.username,
      firstName: v.first_name,
      lastName: v.last_name,
      photoUrl: v.photo_url,
      settings: { create: {} },
    },
    update: { username: v.username, firstName: v.first_name, lastName: v.last_name, photoUrl: v.photo_url },
  });
}

// Redirect (data-auth-url) flow used by the official Login Widget: Telegram
// sends the signed payload here as a GET, we verify it and start the session.
export async function GET(req: Request) {
  const origin = base(req);
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return NextResponse.redirect(new URL("/login", origin));

  const data: Record<string, string> = {};
  new URL(req.url).searchParams.forEach((v, k) => (data[k] = v));
  const verified = verifyTelegramAuth(data, botToken);
  if (!verified) return NextResponse.redirect(new URL("/login?tg=failed", origin));

  const user = await upsertTelegramUser(verified);
  try {
    await evaluateAchievements(user.id);
  } catch {}

  const token = await signSession(user.id);
  const res = NextResponse.redirect(new URL("/", origin));
  res.cookies.set(sessionCookie.name, token, { ...sessionCookie.options, maxAge: sessionCookie.maxAge });
  return res;
}

export async function POST(req: Request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ error: "Telegram bot is not configured" }, { status: 400 });
  }

  const body = (await req.json()) as Record<string, unknown>;
  const data: Record<string, string> = {};
  for (const [k, v] of Object.entries(body)) {
    if (v !== undefined && v !== null) data[k] = String(v);
  }

  const verified = verifyTelegramAuth(data, botToken);
  if (!verified) {
    return NextResponse.json({ error: "Telegram verification failed" }, { status: 401 });
  }

  const telegramId = String(verified.id);
  const user = await prisma.user.upsert({
    where: { telegramId },
    create: {
      telegramId,
      username: verified.username,
      firstName: verified.first_name,
      lastName: verified.last_name,
      photoUrl: verified.photo_url,
      settings: { create: {} },
    },
    update: {
      username: verified.username,
      firstName: verified.first_name,
      lastName: verified.last_name,
      photoUrl: verified.photo_url,
    },
  });

  const token = await signSession(user.id);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookie.name, token, { ...sessionCookie.options, maxAge: sessionCookie.maxAge });
  return res;
}
