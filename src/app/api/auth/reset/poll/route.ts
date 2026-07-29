import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signGrantToken } from "@/lib/jwt";
import { resetGrantCookie } from "@/lib/auth";

// Polled by the browser after opening the reset deep link. Once the bot has
// confirmed the account, this issues a short-lived "reset" grant cookie the
// confirm step consumes — but does NOT sign a full session yet.
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return NextResponse.json({ status: "invalid" }, { status: 400 });

  const row = await prisma.tgAuthToken.findUnique({ where: { token } });
  if (!row || row.kind !== "RESET") return NextResponse.json({ status: "invalid" });

  if (row.status === "ERROR") {
    return NextResponse.json({ status: "error", error: row.error ?? "Something went wrong" });
  }
  if (row.expiresAt.getTime() < Date.now() && row.status === "PENDING") {
    return NextResponse.json({ status: "expired" });
  }
  if (row.status !== "DONE" || !row.resolvedUserId) {
    return NextResponse.json({ status: "pending" });
  }

  // Single-use: consume the token and hand out a purpose-bound grant.
  await prisma.tgAuthToken.update({ where: { token }, data: { status: "CONSUMED" } });
  const grant = await signGrantToken(row.resolvedUserId, "reset", "10m");

  const res = NextResponse.json({ status: "ok" });
  res.cookies.set(resetGrantCookie.name, grant, {
    ...resetGrantCookie.options,
    maxAge: resetGrantCookie.maxAge,
  });
  return res;
}
