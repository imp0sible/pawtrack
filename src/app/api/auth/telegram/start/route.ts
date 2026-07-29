import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createTgToken, deepLink, botUsername } from "@/lib/tg-auth";

// Creates a short-lived token and returns the bot deep link the browser should
// open. kind="login" for signing in, kind="link" for connecting Telegram to the
// already-logged-in account.
export async function POST(req: Request) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !botUsername()) {
    return NextResponse.json({ error: "Telegram bot is not configured" }, { status: 400 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {}
  const kind = body.kind === "link" ? "LINK" : "LOGIN";

  let initiatorUserId: string | undefined;
  if (kind === "LINK") {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    initiatorUserId = user.id;
  }

  const token = await createTgToken(kind, initiatorUserId);
  return NextResponse.json({ token, url: deepLink(kind, token) });
}
