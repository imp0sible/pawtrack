// Best-effort bridge from the Next server to the realtime (socket.io) worker.
// The worker exposes POST /emit guarded by INTERNAL_API_SECRET; if it isn't
// running, emits are silently dropped (the UI still works, just without live
// push until the next data fetch).

import { internalApiSecret } from "@/lib/secrets";

const INTERNAL_URL = process.env.REALTIME_INTERNAL_URL ?? "http://localhost:3001";
const SECRET = internalApiSecret();

export type RealtimeTarget =
  | { kind: "search"; id: string }
  | { kind: "user"; id: string };

export async function emitRealtime(
  target: RealtimeTarget,
  event: string,
  payload: unknown
): Promise<void> {
  try {
    await fetch(`${INTERNAL_URL}/emit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": SECRET,
      },
      body: JSON.stringify({ target, event, payload }),
      // Don't let a slow/absent worker block the request.
      signal: AbortSignal.timeout(1500),
    });
  } catch {
    // Worker not running or unreachable — ignore.
  }
}

export function emitToSearch(searchId: string, event: string, payload: unknown) {
  return emitRealtime({ kind: "search", id: searchId }, event, payload);
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  return emitRealtime({ kind: "user", id: userId }, event, payload);
}
