import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { displayName } from "@/lib/format";
import { Nav } from "@/components/nav";
import { PhoneSetup } from "@/components/phone-setup";
import { PasswordSetup } from "@/components/password-setup";
import { ConnectionStatus } from "@/components/connection-status";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // A phone number and a password are mandatory for every account (e.g.
  // Telegram/dev users start with neither). Block the app until both are set.
  if (!user.phone) return <PhoneSetup />;
  if (!user.passwordHash) return <PasswordSetup />;

  const me = {
    id: user.id,
    name: displayName(user),
    username: user.username,
    photoUrl: user.photoUrl,
    isDeveloper: user.isDeveloper,
  };

  return (
    <div className="flex min-h-full flex-col">
      <ConnectionStatus />
      <Nav me={me} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-6 md:pb-10">{children}</main>
    </div>
  );
}
