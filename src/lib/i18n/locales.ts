export const LOCALES = ["en", "ru", "sr"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "pawtrack:locale";

// Native names shown in the language switcher.
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  ru: "Русский",
  sr: "Srpski",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
