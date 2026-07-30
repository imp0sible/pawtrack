"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PawPrint } from "lucide-react";
import { useT } from "@/lib/i18n/react";

// When the app is opened inside Telegram (as a Mini App), Telegram exposes a
// signed `initData`. We post it to the server to start a session, so the user is
// logged in automatically without ever seeing the login form. Outside Telegram
// (no WebApp / no initData) this renders nothing and the normal form shows.
interface TelegramWebApp {
  initData?: string;
  ready?: () => void;
  expand?: () => void;
}

export function TelegramMiniAppAuth() {
  const t = useT();
  const router = useRouter();
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    const tg = (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;
    if (!tg) return; // not inside Telegram
    tg.ready?.();
    tg.expand?.();

    const initData = tg.initData ?? "";
    if (!initData) return; // opened outside a Mini App context

    setSigning(true);
    fetch("/api/auth/telegram/webapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("verify failed");
        router.replace("/");
        router.refresh();
      })
      .catch(() => setSigning(false)); // fall back to the visible login form
  }, [router]);

  if (!signing) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-[var(--background)]">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--brand)] text-white">
        <PawPrint className="h-7 w-7 animate-pulse" />
      </div>
      <p className="text-sm text-[var(--muted)]">{t("auth.signingIn")}</p>
    </div>
  );
}
