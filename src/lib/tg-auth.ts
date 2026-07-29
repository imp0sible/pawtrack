import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";

export const TG_TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes
export type TgTokenKind = "LOGIN" | "LINK" | "RESET";

// Payload prefixes used in the bot deep link (?start=login_<token>).
export const TG_PREFIX = { LOGIN: "login_", LINK: "link_", RESET: "reset_" } as const;

export async function createTgToken(kind: TgTokenKind, initiatorUserId?: string) {
  const token = randomBytes(24).toString("hex");
  await prisma.tgAuthToken.create({
    data: {
      token,
      kind,
      initiatorUserId: initiatorUserId ?? null,
      expiresAt: new Date(Date.now() + TG_TOKEN_TTL_MS),
    },
  });
  return token;
}

export function botUsername(): string {
  return (
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ??
    process.env.TELEGRAM_BOT_USERNAME ??
    ""
  );
}

export function deepLink(kind: TgTokenKind, token: string): string {
  const user = botUsername();
  return `https://t.me/${user}?start=${TG_PREFIX[kind]}${token}`;
}
