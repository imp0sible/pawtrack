"use client";

// Thin wrapper over the browser's built-in on-device Translator API
// (Chrome/Edge 138+). Free, private, no API key — and it simply reports
// "unavailable" in browsers that don't have it, so callers fall back to the
// original text. Swapping in a server translation API later only means
// replacing this file.

export type Availability = "unavailable" | "downloadable" | "downloading" | "available";

interface TranslatorInstance {
  translate(text: string): Promise<string>;
  destroy?: () => void;
}

interface TranslatorCtor {
  availability(opts: { sourceLanguage: string; targetLanguage: string }): Promise<Availability>;
  create(opts: { sourceLanguage: string; targetLanguage: string }): Promise<TranslatorInstance>;
}

function ctor(): TranslatorCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { Translator?: TranslatorCtor };
  return w.Translator ?? null;
}

// Some environments expose the API but never settle its promises. Never let a
// hung call leave the card stuck with no feedback — fall back instead.
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    let settled = false;
    const done = (value: T) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => done(fallback), ms);
    promise.then(done).catch(() => done(fallback));
  });
}

export function translationSupported(): boolean {
  return ctor() !== null;
}

export async function availabilityFor(source: string, target: string): Promise<Availability> {
  const T = ctor();
  if (!T?.availability) return "unavailable";
  try {
    return await withTimeout<Availability>(
      T.availability({ sourceLanguage: source, targetLanguage: target }),
      5000,
      "unavailable"
    );
  } catch {
    return "unavailable";
  }
}

// Session cache so re-renders / revisits don't re-translate the same strings.
const cache = new Map<string, string>();

/**
 * Translates a map of fields. Returns null if translation isn't possible —
 * callers should then keep showing the original text.
 */
export async function translateFields(
  fields: Record<string, string | null | undefined>,
  source: string,
  target: string
): Promise<Record<string, string> | null> {
  const T = ctor();
  if (!T?.create) return null;

  const work = (async (): Promise<Record<string, string> | null> => {
    const translator = await T.create({ sourceLanguage: source, targetLanguage: target });
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(fields)) {
      const text = (value ?? "").trim();
      if (!text) continue;
      const cacheKey = `${source}|${target}|${text}`;
      const hit = cache.get(cacheKey);
      if (hit !== undefined) {
        out[key] = hit;
        continue;
      }
      const translated = await translator.translate(text);
      cache.set(cacheKey, translated);
      out[key] = translated;
    }
    translator.destroy?.();
    return out;
  })();

  // Model download + translation can be slow; cap it so the UI can recover.
  return withTimeout<Record<string, string> | null>(work, 45000, null);
}
