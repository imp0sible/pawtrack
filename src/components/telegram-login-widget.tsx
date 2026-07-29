"use client";

import { useEffect, useRef } from "react";

// The official Telegram Login Widget (the blue "Log in with Telegram" button).
// Requires the bot's domain to be registered with @BotFather (/setdomain).
//
// We use REDIRECT mode (data-auth-url) rather than the JS callback (data-onauth):
// the callback path makes the widget call eval() to parse the handler, which our
// strict CSP (no 'unsafe-eval') blocks. In redirect mode Telegram sends the
// signed payload straight to our endpoint as a normal GET, which verifies it
// server-side and starts/links the session — no eval, no CSP compromise.
//   - /api/auth/telegram        → log in / create the Telegram user
//   - /api/auth/telegram/link   → attach Telegram to the current account
// The widget <script> is injected here (not written into HTML) so it inherits
// trust under the nonce-based CSP.

export function TelegramLoginWidget({
  botUsername,
  endpoint = "/api/auth/telegram",
}: {
  botUsername?: string;
  endpoint?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const user = botUsername || process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "";

  useEffect(() => {
    const el = containerRef.current;
    if (!user || !el) return;

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", user);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "12");
    script.setAttribute("data-request-access", "write");
    // Absolute URL on the current origin; Telegram redirects here with the
    // signed auth params in the query string once the user confirms.
    script.setAttribute("data-auth-url", window.location.origin + endpoint);
    el.appendChild(script);

    return () => {
      el.innerHTML = "";
    };
  }, [user, endpoint]);

  if (!user) return null;
  return <div ref={containerRef} className="flex justify-center" />;
}
