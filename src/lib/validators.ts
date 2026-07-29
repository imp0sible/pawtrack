import { z } from "zod";

// Image sources we accept: http(s) URLs, or *raster* data URLs only. SVG is
// excluded because it can carry scripts (harmless in <img>, but risky if ever
// opened as a top-level document).
const RASTER_IMAGE = /^(https?:\/\/|data:image\/(png|jpe?g|webp|gif|avif)[;,])/i;

export function isSafeImageSrc(v: string): boolean {
  return RASTER_IMAGE.test(v);
}

/** A single uploaded/linked image, capped in size. */
export const imageSchema = z
  .string()
  .max(3_000_000)
  .refine(isSafeImageSrc, "Invalid image");

/** Like imageSchema but also allows "" (used to clear a photo). */
export const optionalImageSchema = z
  .string()
  .max(3_000_000)
  .refine((v) => v === "" || isSafeImageSrc(v), "Invalid image");

// Only http/https links may be stored and later rendered in an <a href>.
// Rejects javascript:, data:, vbscript:, etc. (stored-XSS vectors).
export function isHttpUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export const httpUrlSchema = z.string().max(500).refine(isHttpUrl, "Must be an http(s) link");
