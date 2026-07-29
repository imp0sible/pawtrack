"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { trpc } from "@/lib/trpc/react";
import { useT } from "@/lib/i18n/react";

export function ChangePassword() {
  const t = useT();
  const me = trpc.user.me.useQuery();
  const hasPassword = me.data?.hasPassword ?? true;

  const [current, setCurrent] = useState("");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const change = trpc.user.changePassword.useMutation({
    onSuccess: () => {
      setMsg({ ok: true, text: t("settings.passwordUpdated") });
      setCurrent("");
      setPw("");
      setConfirm("");
    },
    onError: (e) => {
      const text = e.data?.code === "UNAUTHORIZED" ? t("settings.wrongCurrentPassword") : e.message;
      setMsg({ ok: false, text });
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (pw.length < 6) {
      setMsg({ ok: false, text: t("auth.weakPassword") });
      return;
    }
    if (pw !== confirm) {
      setMsg({ ok: false, text: t("auth.passwordsDontMatch") });
      return;
    }
    change.mutate({ newPassword: pw, ...(hasPassword ? { currentPassword: current } : {}) });
  }

  return (
    <form className="card space-y-4 p-4" onSubmit={submit}>
      <div className="flex items-center gap-4">
        <KeyRound className="h-6 w-6 text-[var(--muted)]" />
        <div className="flex-1">
          <p className="font-medium">{t("settings.changePassword")}</p>
        </div>
      </div>
      {hasPassword && (
        <div>
          <label className="label">{t("settings.currentPassword")}</label>
          <input className="input" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">{t("settings.newPassword")}</label>
          <input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
        </div>
        <div>
          <label className="label">{t("auth.confirmPassword")}</label>
          <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </div>
      </div>
      {msg && <p className={`text-sm ${msg.ok ? "text-[var(--brand-strong)]" : "text-[var(--danger)]"}`}>{msg.text}</p>}
      <button className="btn-primary" type="submit" disabled={change.isPending}>
        {change.isPending ? t("common.saving") : t("settings.updatePassword")}
      </button>
    </form>
  );
}
