"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/react";
import { LOCALES, LOCALE_NAMES } from "@/lib/i18n/locales";

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  const router = useRouter();

  function pick(next: (typeof LOCALES)[number]) {
    if (next === locale) return;
    setLocale(next); // instant client update + persist cookie
    router.refresh(); // re-render server components with the new locale
  }

  return (
    <div className="flex flex-wrap gap-2">
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => pick(l)}
          aria-pressed={l === locale}
          className={
            l === locale
              ? "rounded-xl border border-[var(--brand)] bg-[var(--brand-soft)] px-3 py-1.5 text-sm font-medium text-[var(--brand-strong)]"
              : "rounded-xl border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)] hover:bg-[var(--brand-soft)]"
          }
        >
          {LOCALE_NAMES[l]}
        </button>
      ))}
    </div>
  );
}
