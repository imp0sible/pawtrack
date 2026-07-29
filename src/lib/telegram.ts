import crypto from "node:crypto";

export interface TelegramAuthData {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

// Verifies the Telegram Login Widget payload per
// https://core.telegram.org/widgets/login#checking-authorization
export function verifyTelegramAuth(
  data: Record<string, string>,
  botToken: string
): TelegramAuthData | null {
  const { hash, ...rest } = data;
  if (!hash) return null;

  const checkString = Object.keys(rest)
    .sort()
    .map((k) => `${k}=${rest[k]}`)
    .join("\n");

  const secret = crypto.createHash("sha256").update(botToken).digest();
  const hmac = crypto.createHmac("sha256", secret).update(checkString).digest("hex");

  // Constant-time comparison to avoid leaking the expected hash via timing.
  const a = Buffer.from(hmac, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const authDate = Number(rest.auth_date);
  // Reject stale logins (older than 24h).
  if (!Number.isFinite(authDate) || Date.now() / 1000 - authDate > 86400) return null;

  return {
    id: Number(rest.id),
    first_name: rest.first_name,
    last_name: rest.last_name,
    username: rest.username,
    photo_url: rest.photo_url,
    auth_date: authDate,
    hash,
  };
}

export function dmLink(username?: string | null): string | null {
  if (!username) return null;
  return `https://t.me/${username.replace(/^@/, "")}`;
}

export function botDeepLink(botUsername: string, payload: string): string {
  return `https://t.me/${botUsername.replace(/^@/, "")}?start=${encodeURIComponent(payload)}`;
}
