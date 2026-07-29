"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/react";
import { availabilityFor, translateFields } from "@/lib/translate";

export type TranslateStatus =
  | "off" // nothing to do (same language, or unknown source)
  | "checking"
  | "offer" // model needs downloading — requires a user click
  | "working"
  | "translated"
  | "unavailable";

/**
 * Auto-translates a card's free-text fields into the user's chosen language
 * using on-device translation, falling back to the original text whenever
 * translation isn't possible.
 */
export function useAutoTranslate(
  fields: Record<string, string | null | undefined>,
  sourceLang: string | null | undefined
) {
  const { locale } = useI18n();
  const target: string = locale;
  // Stable dependency: the caller passes a fresh object literal each render.
  const payload = JSON.stringify(fields);
  const needs = Boolean(sourceLang) && sourceLang !== target;

  const [translated, setTranslated] = useState<Record<string, string> | null>(null);
  const [status, setStatus] = useState<TranslateStatus>("off");
  const [showOriginal, setShowOriginal] = useState(false);

  // Used for the "offer" path, where Chrome needs a user gesture to download.
  const translate = useCallback(async () => {
    if (!sourceLang) return;
    setStatus("working");
    const out = await translateFields(JSON.parse(payload), sourceLang, target);
    if (out && Object.keys(out).length > 0) {
      setTranslated(out);
      setStatus("translated");
    } else {
      setStatus("unavailable");
    }
  }, [payload, sourceLang, target]);

  useEffect(() => {
    let cancelled = false;
    setTranslated(null);
    setShowOriginal(false);

    if (!needs || !sourceLang) {
      setStatus("off");
      return;
    }

    setStatus("checking");
    (async () => {
      const availability = await availabilityFor(sourceLang, target);
      if (cancelled) return;

      if (availability === "available") {
        const out = await translateFields(JSON.parse(payload), sourceLang, target);
        if (cancelled) return;
        if (out && Object.keys(out).length > 0) {
          setTranslated(out);
          setStatus("translated");
        } else {
          setStatus("unavailable");
        }
      } else if (availability === "downloadable" || availability === "downloading") {
        setStatus("offer");
      } else {
        setStatus("unavailable");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [needs, sourceLang, target, payload]);

  const values: Record<string, string | null | undefined> =
    translated && !showOriginal ? { ...fields, ...translated } : fields;

  return {
    values,
    status,
    translate,
    showOriginal,
    setShowOriginal,
    sourceLang: sourceLang ?? null,
    isTranslated: status === "translated" && !showOriginal,
  };
}
