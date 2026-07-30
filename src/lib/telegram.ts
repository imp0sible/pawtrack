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

export interface TelegramWebAppUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

// Verifies Telegram Mini App `initData` per
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
// NOTE: the algorithm differs from the Login Widget above — the secret key is
// HMAC_SHA256(botToken) keyed by the literal string "WebAppData".
export function verifyWebAppInitData(initData: string, botToken: string): TelegramWebAppUser | null {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(initData);
  } catch {
    return null;
  }
  const hash = params.get("hash");
  if (!hash) return null;

  const pairs: string[] = [];
  params.forEach((value, key) => {
    // `hash` is what we're checking; `signature` is Telegram's separate 3rd-party
    // (Ed25519) field and is excluded from the HMAC data-check-string.
    if (key === "hash" || key === "signature") return;
    pairs.push(`${key}=${value}`);
  });
  pairs.sort();
  const dataCheckString = pairs.join("\n");

  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const hmac = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");

  let a: Buffer;
  let b: Buffer;
  try {
    a = Buffer.from(hmac, "hex");
    b = Buffer.from(hash, "hex");
  } catch {
    return null;
  }
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  // Freshness: reject payloads older than 24h.
  const authDate = Number(params.get("auth_date"));
  if (!Number.isFinite(authDate) || Date.now() / 1000 - authDate > 86400) return null;

  const userJson = params.get("user");
  if (!userJson) return null;
  try {
    const u = JSON.parse(userJson) as TelegramWebAppUser;
    return typeof u.id === "number" ? u : null;
  } catch {
    return null;
  }
}

export function dmLink(username?: string | null): string | null {
  if (!username) return null;
  return `https://t.me/${username.replace(/^@/, "")}`;
}

export function botDeepLink(botUsername: string, payload: string): string {
  return `https://t.me/${botUsername.replace(/^@/, "")}?start=${encodeURIComponent(payload)}`;
}
