"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { MESSAGES, type MessageKey } from "./messages";
import { LOCALE_COOKIE, DEFAULT_LOCALE, type Locale } from "./locales";

export type TFunction = (key: MessageKey, vars?: Record<string, string | number>) => string;

interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TFunction;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ locale: initial, children }: { locale: Locale; children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initial);

  // Keep in sync when the server passes a new locale (e.g. after router.refresh).
  useEffect(() => {
    setLocaleState(initial);
  }, [initial]);

  const t = useCallback<TFunction>(
    (key, vars) => {
      const dict = MESSAGES[locale] ?? MESSAGES[DEFAULT_LOCALE];
      let msg = dict[key] ?? MESSAGES[DEFAULT_LOCALE][key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) msg = msg.replaceAll(`{${k}}`, String(v));
      }
      return msg;
    },
    [locale]
  );

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    } catch {}
  }, []);

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export function useT(): TFunction {
  return useI18n().t;
}
