"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { useT } from "@/lib/i18n/react";

type Mode = "login" | "link";
type Status = "idle" | "waiting" | "error";

// Opens the bot deep link and polls until the bot resolves it. Works locally
// (long-polling bot) without a public domain, unlike the login widget.
export function TelegramAuthButton({
  mode,
  onDone,
  className,
}: {
  mode: Mode;
  onDone: () => void;
  className?: string;
}) {
  const t = useT();
  const [status, setStatus] = useState<Status>("idle");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stop() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }
  useEffect(() => () => stop(), []);

  async function start() {
    setStatus("waiting");
    try {
      const res = await fetch("/api/auth/telegram/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: mode }),
      });
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
          const p = await fetch(`/api/auth/telegram/poll?token=${encodeURIComponent(token)}`);
          const pd = await p.json();
          if (pd.status === "ok") {
            stop();
            setStatus("idle");
            onDone();
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

  const label = mode === "login" ? t("auth.telegramContinue") : t("auth.telegramConnect");
  const waitingText = mode === "login" ? t("auth.telegramWaiting") : t("auth.telegramConnecting");
  const errorText = mode === "login" ? t("auth.telegramFailed") : t("auth.telegramConnectFailed");

  return (
    <div>
      <button
        type="button"
        onClick={start}
        disabled={status === "waiting"}
        className={className ?? "btn-ghost inline-flex w-full items-center justify-center gap-2"}
      >
        <Send className="h-4 w-4" />
        {status === "waiting" ? "…" : label}
      </button>
      {status === "waiting" && <p className="mt-2 text-xs text-[var(--muted)]">{waitingText}</p>}
      {status === "error" && <p className="mt-2 text-xs text-[var(--danger)]">{errorText}</p>}
    </div>
  );
}
