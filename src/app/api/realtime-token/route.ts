import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { signSessionToken } from "@/lib/jwt";

// Mints a short-lived token the browser passes in the socket.io handshake.
// (The httpOnly, SameSite=Lax session cookie isn't sent cross-origin to the
// realtime worker, so it can't be used for the socket directly.)
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const token = await signSessionToken(user.id, "15m");
  return NextResponse.json({ token });
}
