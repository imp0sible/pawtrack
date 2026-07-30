"use client";

import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";
import { useT } from "@/lib/i18n/react";

// Shown instead of the app for a banned account. Signing out is the only action.
export function BannedScreen({ reason }: { reason: string | null }) {
  const t = useT();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4 py-16">
      <div className="card w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--danger)] text-white">
          <Ban className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">{t("banned.title")}</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">{t("banned.body")}</p>
        {reason && (
          <p className="mt-3 rounded-xl bg-[var(--background)] p-3 text-sm">
            <span className="font-medium">{t("banned.reason")}:</span> {reason}
          </p>
        )}
        <p className="mt-3 text-xs text-[var(--muted)]">{t("banned.appeal")}</p>
        <button className="btn-ghost mt-5 w-full" onClick={logout}>
          {t("nav.signOut")}
        </button>
      </div>
    </div>
  );
}
