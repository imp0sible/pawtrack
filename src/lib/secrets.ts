// Central place for the shared secret guarding the internal /emit bridge.
// In production it MUST be set to a real value; we never fall back to a
// hardcoded default that ships in the source.
const DEV_FALLBACK = "dev-internal-secret";

export function internalApiSecret(): string {
  const secret = process.env.INTERNAL_API_SECRET;
  if (secret && secret.length > 0) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("INTERNAL_API_SECRET must be set in production");
  }
  return DEV_FALLBACK;
}
