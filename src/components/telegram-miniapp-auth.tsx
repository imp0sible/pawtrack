"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PawPrint, AlertTriangle, RotateCw } from "lucide-react";
import { useT } from "@/lib/i18n/react";

// When the app is opened inside Telegram (as a Mini App), Telegram exposes a
// signed `initData`. We post it to the server to start a session — no login
// form, no widget (the widget can't do Telegram-OAuth inside Telegram). This
// component TAKES OVER the login screen whenever we're inside Telegram, so the
// broken widget is never reachable there. Outside Telegram it renders nothing.
interface TelegramWebApp {
  initData?: string;
  ready?: () => void;
  expand?: () => void;
}

type Phase = "checking" | "signing" | "error" | "off";

function getWebApp(): TelegramWebApp | undefined {
  return (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;
}

export function TelegramMiniAppAuth() {
  const t = useT();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("checking");
  const [detail, setDetail] = useState<string | null>(null);
  const initDataRef = useRef<string>("");

  const attempt = useCallback(
    async (initData: string) => {
      setPhase("signing");
      setDetail(null);
      try {
        const res = await fetch("/api/auth/telegram/webapp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
        router.replace("/");
        router.refresh();
      } catch (e) {
        setDetail(e instanceof Error ? e.message : "network error");
        setPhase("error");
      }
    },
    [router]
  );

  useEffect(() => {
    let tries = 0;
    // The SDK script is a blocking tag before hydration, so WebApp is normally
    // present on the first check; poll briefly as a safety net.
    const timer = setInterval(() => {
      const tg = getWebApp();
      tries++;
      if (tg) {
        clearInterval(timer);
        tg.ready?.();
        tg.expand?.();
        const initData = tg.initData ?? "";
        if (!initData) {
          setPhase("off"); // in a browser, or opened without signed data
          return;
        }
        initDataRef.current = initData;
        attempt(initData);
      } else if (tries >= 10) {
        clearInterval(timer);
        setPhase("off"); // not inside Telegram
      }
    }, 100);
    return () => clearInterval(timer);
  }, [attempt]);

  if (phase === "off") return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-[var(--background)] px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--brand)] text-white">
        <PawPrint className={`h-7 w-7 ${phase === "error" ? "" : "animate-pulse"}`} />
      </div>

      {phase === "error" ? (
        <>
          <AlertTriangle className="h-5 w-5 text-[var(--danger)]" />
          <p className="text-sm font-medium">{t("auth.telegramFailed")}</p>
          {detail && <p className="max-w-xs font-mono text-[11px] text-[var(--muted)]">{detail}</p>}
          <button
            className="btn-primary mt-1 inline-flex items-center gap-1.5"
            onClick={() => attempt(initDataRef.current)}
          >
            <RotateCw className="h-4 w-4" /> {t("common.retry")}
          </button>
        </>
      ) : (
        <p className="text-sm text-[var(--muted)]">{t("auth.signingIn")}</p>
      )}
    </div>
  );
}
