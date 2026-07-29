"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/react";

// The official Telegram Login Widget (the blue "Log in with Telegram" button).
// Requires the bot's domain to be registered with @BotFather (/setdomain).
//
// Telegram calls our global callback with the signed user payload; we POST it to
// /api/auth/telegram, which verifies the signature server-side and starts the
// session. The widget <script> is injected here (not written into the HTML) so
// it inherits trust under the app's strict, nonce-based CSP.

interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

const CALLBACK = "onTelegramAuth";

export function TelegramLoginWidget({ botUsername, onDone }: { botUsername: string; onDone: () => void }) {
  const t = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    w[CALLBACK] = async (user: TelegramUser) => {
      setError(null);
      try {
        const res = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(user),
        });
        if (!res.ok) throw new Error("verify failed");
        onDone();
      } catch {
        setError(t("auth.telegramFailed"));
      }
    };

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "12");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-onauth", `${CALLBACK}(user)`);
    const el = containerRef.current;
    el?.appendChild(script);

    return () => {
      delete w[CALLBACK];
      if (el) el.innerHTML = "";
    };
  }, [botUsername, onDone, t]);

  return (
    <div>
      <div ref={containerRef} className="flex justify-center" />
      {error && <p className="mt-2 text-center text-xs text-[var(--danger)]">{error}</p>}
    </div>
  );
}
