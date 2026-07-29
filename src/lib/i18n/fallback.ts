// Standalone, provider-independent strings for the resilience surfaces
// (error boundary, 404, global crash, offline banner). These pages must render
// even when the normal I18nProvider isn't mounted — e.g. an error thrown above
// it, or the root layout itself failing — so they can't depend on useT().
//
// Locale is detected from the <html lang> the root layout set, falling back to
// the locale cookie, then English.

import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./locales";

type Key =
  | "error.title"
  | "error.body"
  | "error.retry"
  | "error.home"
  | "notFound.title"
  | "notFound.body"
  | "notFound.home"
  | "offline.message";

const STRINGS: Record<Locale, Record<Key, string>> = {
  en: {
    "error.title": "Something went wrong",
    "error.body": "An unexpected error interrupted this page. You can try again — if it keeps happening, please report a bug.",
    "error.retry": "Try again",
    "error.home": "Back home",
    "notFound.title": "Page not found",
    "notFound.body": "The page you're looking for doesn't exist or may have moved.",
    "notFound.home": "Back home",
    "offline.message": "You're offline — some things may not update until your connection returns.",
  },
  ru: {
    "error.title": "Что-то пошло не так",
    "error.body": "Непредвиденная ошибка прервала загрузку страницы. Попробуйте ещё раз — если ошибка повторяется, сообщите о ней.",
    "error.retry": "Повторить",
    "error.home": "На главную",
    "notFound.title": "Страница не найдена",
    "notFound.body": "Страница, которую вы ищете, не существует или была перемещена.",
    "notFound.home": "На главную",
    "offline.message": "Вы офлайн — часть данных может не обновляться до восстановления соединения.",
  },
  sr: {
    "error.title": "Nešto je pošlo po zlu",
    "error.body": "Neočekivana greška je prekinula ovu stranicu. Pokušajte ponovo — ako se ponavlja, prijavite grešku.",
    "error.retry": "Pokušaj ponovo",
    "error.home": "Nazad na početnu",
    "notFound.title": "Stranica nije pronađena",
    "notFound.body": "Stranica koju tražite ne postoji ili je premeštena.",
    "notFound.home": "Nazad na početnu",
    "offline.message": "Van mreže ste — neki podaci se možda neće ažurirati dok se veza ne vrati.",
  },
};

export function detectLocale(): Locale {
  if (typeof document !== "undefined") {
    const htmlLang = document.documentElement.lang;
    if (isLocale(htmlLang)) return htmlLang;
    const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]+)`));
    if (match && isLocale(match[1])) return match[1];
  }
  return DEFAULT_LOCALE;
}

export function fallbackT(locale: Locale = detectLocale()): (key: Key) => string {
  const dict = STRINGS[locale] ?? STRINGS[DEFAULT_LOCALE];
  return (key: Key) => dict[key] ?? STRINGS[DEFAULT_LOCALE][key] ?? key;
}
