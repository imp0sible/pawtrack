import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signSession, sessionCookie } from "@/lib/auth";
import { verifyTelegramAuth } from "@/lib/telegram";

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
