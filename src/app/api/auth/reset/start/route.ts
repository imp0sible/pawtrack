import { NextResponse } from "next/server";
import { createTgToken, deepLink, botUsername } from "@/lib/tg-auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";

// Begins a Telegram-based password reset: mints a RESET token and returns the
// bot deep link. The bot will only resolve it for the account already connected
// to the Telegram user who opens it (see handleReset in the bot).
export async function POST(req: Request) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !botUsername()) {
    return NextResponse.json({ error: "Telegram bot is not configured" }, { status: 400 });
  }
  if (!rateLimit(`reset:${clientIp(req)}`, 5, 60_000)) {
    return NextResponse.json({ error: "Too many attempts. Try again in a minute." }, { status: 429 });
  }
  const token = await createTgToken("RESET");
  return NextResponse.json({ token, url: deepLink("RESET", token) });
}
