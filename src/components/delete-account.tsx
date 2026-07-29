"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc/react";
import { useT } from "@/lib/i18n/react";

export function DeleteAccount() {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const del = trpc.user.deleteAccount.useMutation({
    onSuccess: async () => {
      // Clear the (now-orphaned) session cookie, then send them to sign-in.
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
      router.push("/login");
      router.refresh();
    },
    onError: (e) => setError(e.message),
  });

  return (
    <div className="card border border-[var(--danger)]/30 p-4">
      <div className="flex items-center gap-4">
        <AlertTriangle className="h-6 w-6 text-[var(--danger)]" />
        <div className="flex-1">
          <p className="font-medium text-[var(--danger)]">{t("settings.dangerZone")}</p>
          <p className="text-xs text-[var(--muted)]">{t("settings.deleteAccountDesc")}</p>
        </div>
      </div>

      {!open ? (
        <button className="btn-danger mt-3 w-full" onClick={() => setOpen(true)}>
          <Trash2 className="h-4 w-4" /> {t("settings.deleteAccount")}
        </button>
      ) : (
        <div className="mt-3 space-y-3 rounded-xl bg-[var(--background)] p-3">
          <p className="font-semibold">{t("settings.deleteConfirmTitle")}</p>
          <p className="text-sm text-[var(--muted)]">{t("settings.deleteConfirmBody")}</p>
          <div>
            <label className="label">{t("settings.deleteConfirmType")}</label>
            <input
              className="input"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              placeholder="DELETE"
            />
          </div>
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          <div className="flex gap-2">
            <button className="btn-ghost flex-1" onClick={() => { setOpen(false); setConfirmText(""); setError(null); }}>
              {t("common.cancel")}
            </button>
            <button
              className="btn-danger flex-1"
              disabled={confirmText !== "DELETE" || del.isPending}
              onClick={() => del.mutate()}
            >
              {del.isPending ? t("settings.deleting") : t("settings.deleteConfirmCta")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
