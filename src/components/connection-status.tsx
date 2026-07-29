"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { fallbackT } from "@/lib/i18n/fallback";

// A small, fixed banner shown while the browser reports it's offline. Uses the
// standalone fallback strings so it never depends on render-time context.
export function ConnectionStatus() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;
  const t = fallbackT();

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-[var(--danger)] px-4 py-2 text-center text-xs font-medium text-white"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      {t("offline.message")}
    </div>
  );
}
