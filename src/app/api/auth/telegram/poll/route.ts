import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signSession, sessionCookie } from "@/lib/auth";

// Polled by the browser after opening the bot deep link. When the bot has
// resolved the token, this signs the session (LOGIN) or confirms the link.
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return NextResponse.json({ status: "invalid" }, { status: 400 });

  const row = await prisma.tgAuthToken.findUnique({ where: { token } });
  if (!row) return NextResponse.json({ status: "invalid" });

  if (row.status === "ERROR") {
    return NextResponse.json({ status: "error", error: row.error ?? "Something went wrong" });
  }
  if (row.expiresAt.getTime() < Date.now() && row.status === "PENDING") {
    return NextResponse.json({ status: "expired" });
  }
  if (row.status !== "DONE" || !row.resolvedUserId) {
    return NextResponse.json({ status: "pending" });
  }

  // Single-use: mark consumed so the token can't be replayed.
  await prisma.tgAuthToken.update({ where: { token }, data: { status: "CONSUMED" } });

  if (row.kind === "LOGIN") {
    const sessionToken = await signSession(row.resolvedUserId);
    const res = NextResponse.json({ status: "ok" });
    res.cookies.set(sessionCookie.name, sessionToken, {
      ...sessionCookie.options,
      maxAge: sessionCookie.maxAge,
    });
    return res;
  }

  // LINK: nothing to set — the account is already signed in.
  return NextResponse.json({ status: "ok" });
}
