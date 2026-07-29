"use client";

import Link from "next/link";
import { Compass, Home } from "lucide-react";
import { fallbackT } from "@/lib/i18n/fallback";

export default function NotFound() {
  const t = fallbackT();
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--brand-soft)]">
        <Compass className="h-7 w-7 text-[var(--brand-strong)]" />
      </div>
      <p className="text-4xl font-bold tracking-tight text-[var(--muted)]">404</p>
      <h1 className="mt-1 text-xl font-bold tracking-tight">{t("notFound.title")}</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">{t("notFound.body")}</p>
      <Link href="/" className="btn-primary mt-6 inline-flex items-center gap-1.5">
        <Home className="h-4 w-4" /> {t("notFound.home")}
      </Link>
    </div>
  );
}
