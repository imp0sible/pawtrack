import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { verifyTelegramAuth } from "@/lib/telegram";

// Attaches a Telegram account (verified via the official Login Widget) to the
// ALREADY signed-in user — unlike /api/auth/telegram, which logs in/creates the
// Telegram user. Used by the "Connect Telegram" button in the profile.
export async function POST(req: Request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return NextResponse.json({ error: "Telegram bot is not configured" }, { status: 400 });

  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = (await req.json()) as Record<string, unknown>;
  const data: Record<string, string> = {};
  for (const [k, v] of Object.entries(body)) {
    if (v !== undefined && v !== null) data[k] = String(v);
  }

  const verified = verifyTelegramAuth(data, botToken);
  if (!verified) return NextResponse.json({ error: "Telegram verification failed" }, { status: 401 });

  const telegramId = String(verified.id);
  const existing = await prisma.user.findUnique({ where: { telegramId } });
  if (existing && existing.id !== me.id) {
    return NextResponse.json(
      { error: "This Telegram account is already linked to another PawTrack account." },
      { status: 409 }
    );
  }

  // Adopt the Telegram username only if the account has none and it's free.
  const update: { telegramId: string; username?: string } = { telegramId };
  if (!me.username && verified.username) {
    const taken = await prisma.user.findUnique({ where: { username: verified.username } });
    if (!taken) update.username = verified.username;
  }

  await prisma.user.update({ where: { id: me.id }, data: update });
  return NextResponse.json({ ok: true });
}
