"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/react";

// The official Telegram Login Widget (the blue "Log in with Telegram" button).
// Requires the bot's domain to be registered with @BotFather (/setdomain).
//
// Telegram calls our global callback with the signed user payload; we POST it to
// `endpoint`, which verifies the signature server-side. Two uses:
//   - /api/auth/telegram        → log in / create the Telegram user
//   - /api/auth/telegram/link   → attach Telegram to the current account
// The widget <script> is injected here (not written into the HTML) so it
// inherits trust under the app's strict, nonce-based CSP.

interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

let counter = 0;

export function TelegramLoginWidget({
  botUsername,
  onDone,
  endpoint = "/api/auth/telegram",
}: {
  botUsername?: string;
  onDone: () => void;
  endpoint?: string;
}) {
  const t = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  // Fall back to the public env var so the widget works from client-only
  // contexts (e.g. the profile page) without threading the name through props.
  const user = botUsername || process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "";

  useEffect(() => {
    if (!user) return;
    const callbackName = `onTelegramAuth_${counter++}`;
    const w = window as unknown as Record<string, unknown>;
    w[callbackName] = async (tgUser: TelegramUser) => {
      setError(null);
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(tgUser),
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
    script.setAttribute("data-telegram-login", user);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "12");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-onauth", `${callbackName}(user)`);
    const el = containerRef.current;
    el?.appendChild(script);

    return () => {
      delete w[callbackName];
      if (el) el.innerHTML = "";
    };
  }, [user, endpoint, onDone, t]);

  if (!user) return null;

  return (
    <div>
      <div ref={containerRef} className="flex justify-center" />
      {error && <p className="mt-2 text-center text-xs text-[var(--danger)]">{error}</p>}
    </div>
  );
}
