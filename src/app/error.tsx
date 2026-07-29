"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCw, Home } from "lucide-react";
import { fallbackT } from "@/lib/i18n/fallback";

// Route-level error boundary. Renders inside the root layout, but uses the
// standalone fallback strings so it works even if a provider is the thing that
// broke.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = fallbackT();

  useEffect(() => {
    // Surface for logging/observability; a real logger can hook in here.
    console.error("[app error]", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--brand-soft)]">
        <AlertTriangle className="h-7 w-7 text-[var(--brand-strong)]" />
      </div>
      <h1 className="text-xl font-bold tracking-tight">{t("error.title")}</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">{t("error.body")}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button className="btn-primary inline-flex items-center gap-1.5" onClick={reset}>
          <RotateCw className="h-4 w-4" /> {t("error.retry")}
        </button>
        <Link href="/" className="btn-ghost inline-flex items-center gap-1.5">
          <Home className="h-4 w-4" /> {t("error.home")}
        </Link>
      </div>
      {error.digest && <p className="mt-6 font-mono text-[11px] text-[var(--muted)]">ref: {error.digest}</p>}
    </div>
  );
}
