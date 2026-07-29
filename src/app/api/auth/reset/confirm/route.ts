import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { verifyGrantToken } from "@/lib/jwt";
import { signSession, sessionCookie, resetGrantCookie } from "@/lib/auth";

// Consumes the reset grant issued by /reset/poll, sets the new password, and
// signs the user in. The grant is single-purpose and short-lived.
export async function POST(req: Request) {
  const store = await cookies();
  const grant = store.get(resetGrantCookie.name)?.value;
  const userId = grant ? await verifyGrantToken(grant, "reset") : null;
  if (!userId) {
    return NextResponse.json({ error: "Your reset session expired. Please start again." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const newPassword = String(body.newPassword ?? "");
  if (newPassword.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters.", field: "newPassword" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  await prisma.user.update({ where: { id: userId }, data: { passwordHash: hashPassword(newPassword) } });

  const sessionToken = await signSession(userId);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookie.name, sessionToken, { ...sessionCookie.options, maxAge: sessionCookie.maxAge });
  // Clear the one-time reset grant.
  res.cookies.set(resetGrantCookie.name, "", { ...resetGrantCookie.options, maxAge: 0 });
  return res;
}
