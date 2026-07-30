import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signSession, sessionCookie } from "@/lib/auth";
import { verifyWebAppInitData } from "@/lib/telegram";
import { evaluateAchievements } from "@/lib/achievements";

// Mini App auto-login: the app, running inside Telegram, posts its signed
// `initData` here. We verify it server-side and start the session — no login
// screen inside Telegram.
export async function POST(req: Request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return NextResponse.json({ error: "Telegram bot is not configured" }, { status: 400 });

  let body: { initData?: unknown };
  try {
    body = (await req.json()) as { initData?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const initData = typeof body.initData === "string" ? body.initData : "";
  if (!initData) return NextResponse.json({ error: "Missing initData" }, { status: 400 });

  const v = verifyWebAppInitData(initData, botToken);
  if (!v) return NextResponse.json({ error: "Telegram verification failed" }, { status: 401 });

  const telegramId = String(v.id);
  const user = await prisma.user.upsert({
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

  try {
    await evaluateAchievements(user.id);
  } catch {}

  const token = await signSession(user.id);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookie.name, token, { ...sessionCookie.options, maxAge: sessionCookie.maxAge });
  return res;
}
