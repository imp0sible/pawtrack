"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, KeyRound } from "lucide-react";
import { useT } from "@/lib/i18n/react";

type Status = "idle" | "waiting" | "confirmed" | "saving" | "error";

// Telegram-backed password recovery. The account's linked Telegram identity is
// the proof: start → open bot deep link → poll until confirmed → set new
// password (which also signs the user in).
export function ResetPassword({
  botUsername,
  onBack,
  onDone,
}: {
  botUsername: string;
  onBack: () => void;
  onDone: () => void;
}) {
  const t = useT();
  const [status, setStatus] = useState<Status>("idle");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stop() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }
  useEffect(() => () => stop(), []);

  async function start() {
    setError(null);
    setStatus("waiting");
    try {
      const res = await fetch("/api/auth/reset/start", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "failed");

      window.open(data.url, "_blank", "noopener");
      const token: string = data.token;
      const deadline = Date.now() + 3 * 60 * 1000;
      stop();
      pollRef.current = setInterval(async () => {
        if (Date.now() > deadline) {
          stop();
          setStatus("error");
          return;
        }
        try {
          const p = await fetch(`/api/auth/reset/poll?token=${encodeURIComponent(token)}`);
          const pd = await p.json();
          if (pd.status === "ok") {
            stop();
            setStatus("confirmed");
          } else if (["error", "expired", "invalid"].includes(pd.status)) {
            stop();
            setStatus("error");
          }
        } catch {
          /* keep polling */
        }
      }, 1600);
    } catch {
      setStatus("error");
    }
  }

  async function submitNewPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError(t("auth.passwordsDontMatch"));
      return;
    }
    if (password.length < 6) {
      setError(t("auth.weakPassword"));
      return;
    }
    setStatus("saving");
    try {
      const res = await fetch("/api/auth/reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "failed");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed");
      setStatus("confirmed");
    }
  }

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
        <ArrowLeft className="h-4 w-4" /> {t("reset.backToSignIn")}
      </button>

      <div>
        <h2 className="text-lg font-bold tracking-tight">{t("reset.title")}</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{t("reset.subtitle")}</p>
      </div>

      {!botUsername ? (
        <p className="rounded-xl bg-[var(--brand-soft)] p-3 text-sm text-[var(--foreground)]">{t("reset.needTelegram")}</p>
      ) : status === "confirmed" || status === "saving" ? (
        <form className="space-y-3" onSubmit={submitNewPassword}>
          <p className="text-sm text-[var(--brand-strong)]">{t("reset.confirmed")}</p>
          <div>
            <label className="label">{t("reset.newPassword")}</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          </div>
          <div>
            <label className="label">{t("auth.confirmPassword")}</label>
            <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </div>
          <button className="btn-primary inline-flex w-full items-center justify-center gap-1.5" type="submit" disabled={status === "saving"}>
            <KeyRound className="h-4 w-4" />
            {status === "saving" ? t("common.saving") : t("reset.setPassword")}
          </button>
        </form>
      ) : (
        <div>
          <button
            type="button"
            onClick={start}
            disabled={status === "waiting"}
            className="btn-ghost inline-flex w-full items-center justify-center gap-2"
          >
            <Send className="h-4 w-4" />
            {status === "waiting" ? "…" : t("reset.start")}
          </button>
          {status === "waiting" && <p className="mt-2 text-xs text-[var(--muted)]">{t("reset.waiting")}</p>}
          {status === "error" && <p className="mt-2 text-xs text-[var(--danger)]">{t("reset.failed")}</p>}
        </div>
      )}

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
    </div>
  );
}
