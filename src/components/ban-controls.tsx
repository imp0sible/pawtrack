"use client";

import { useState } from "react";
import { Ban, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc/react";
import { useT } from "@/lib/i18n/react";

// Developer-only ban / unban panel, shown on another user's profile.
export function BanControls({
  userId,
  bannedAt,
  banReason,
  isDeveloper,
  onChanged,
}: {
  userId: string;
  bannedAt: Date | null;
  banReason: string | null;
  isDeveloper: boolean;
  onChanged: () => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const ban = trpc.moderation.banUser.useMutation({
    onSuccess: () => {
      setOpen(false);
      setReason("");
      onChanged();
    },
  });
  const unban = trpc.moderation.unbanUser.useMutation({ onSuccess: onChanged });

  if (isDeveloper) {
    return (
      <p className="text-xs text-[var(--muted)]">{t("ban.cannotBanDeveloper")}</p>
    );
  }

  if (bannedAt) {
    return (
      <div className="card border border-[var(--danger)]/30 p-4">
        <p className="flex items-center gap-2 text-sm font-medium text-[var(--danger)]">
          <Ban className="h-4 w-4" /> {t("ban.banned")}
        </p>
        {banReason && <p className="mt-1 text-xs text-[var(--muted)]">{banReason}</p>}
        <button
          className="btn-ghost mt-3 inline-flex items-center gap-1.5"
          onClick={() => unban.mutate({ userId })}
          disabled={unban.isPending}
        >
          <ShieldCheck className="h-4 w-4" /> {t("ban.unban")}
        </button>
        {unban.error && <p className="mt-2 text-xs text-[var(--danger)]">{unban.error.message}</p>}
      </div>
    );
  }

  return (
    <div className="card p-4">
      {!open ? (
        <button className="btn-ghost inline-flex items-center gap-1.5 text-[var(--danger)]" onClick={() => setOpen(true)}>
          <Ban className="h-4 w-4" /> {t("ban.ban")}
        </button>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="label">{t("ban.reason")}</label>
            <input
              className="input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("ban.reasonPlaceholder")}
              maxLength={500}
            />
          </div>
          {ban.error && <p className="text-sm text-[var(--danger)]">{ban.error.message}</p>}
          <div className="flex gap-2">
            <button className="btn-ghost flex-1" onClick={() => { setOpen(false); setReason(""); }}>
              {t("common.cancel")}
            </button>
            <button
              className="btn-danger flex-1"
              onClick={() => ban.mutate({ userId, reason: reason.trim() || undefined })}
              disabled={ban.isPending}
            >
              {ban.isPending ? t("ban.banning") : t("ban.confirm")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
