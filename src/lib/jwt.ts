import { SignJWT, jwtVerify } from "jose";

// Pure JWT helpers with no next/headers dependency, so both the Next server
// and the standalone realtime worker can share them.

const DEV_JWT_SECRET = "dev-only-secret-please-change-in-production-0a1b2c3d4e5f6071";

function secretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  if (process.env.NODE_ENV === "production") {
    // Fail closed on a weak or default signing key in production.
    if (secret === DEV_JWT_SECRET || secret.length < 32) {
      throw new Error("JWT_SECRET must be a strong, non-default value (>=32 chars) in production");
    }
  }
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(userId: string, expiresIn: string = "30d"): Promise<string> {
  return new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return typeof payload.uid === "string" ? payload.uid : null;
  } catch {
    return null;
  }
}

// Short-lived, single-purpose grant (e.g. "reset"): proves a specific action was
// authorized without being a full login session. The purpose is bound into the
// token so a reset grant can't be replayed as anything else.
export async function signGrantToken(userId: string, purpose: string, expiresIn: string): Promise<string> {
  return new SignJWT({ uid: userId, purpose })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey());
}

export async function verifyGrantToken(token: string, purpose: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.purpose !== purpose) return null;
    return typeof payload.uid === "string" ? payload.uid : null;
  } catch {
    return null;
  }
}
