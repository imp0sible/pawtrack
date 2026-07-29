"use client";

// On-device image embeddings via transformers.js (CLIP image encoder).
// Runs entirely in the browser: free, private, no API key. Every failure path
// returns null so callers fall back to distance-only ranking.

const MODEL = "Xenova/clip-vit-base-patch32";
const MAX_DIMS = 2048; // matches the server-side input cap

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Extractor = (input: string) => Promise<any>;

let extractorPromise: Promise<Extractor | null> | null = null;

export function embeddingSupported(): boolean {
  return typeof window !== "undefined";
}

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

async function getExtractor(): Promise<Extractor | null> {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      try {
        // Loaded lazily so the model/runtime never touches the initial bundle.
        const mod = await import("@huggingface/transformers");
        mod.env.allowLocalModels = false;
        const pipe = await mod.pipeline("image-feature-extraction", MODEL);
        return pipe as unknown as Extractor;
      } catch {
        return null;
      }
    })();
  }
  return extractorPromise;
}

/** Turns a model output tensor into a single pooled vector. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toVector(output: any): number[] | null {
  const data: ArrayLike<number> | undefined = output?.data;
  if (!data || typeof data.length !== "number" || data.length === 0) return null;
  const dims: number[] | undefined = output?.dims;

  // [1, tokens, features] -> mean-pool over tokens
  if (Array.isArray(dims) && dims.length === 3) {
    const [, tokens, features] = dims;
    if (tokens > 0 && features > 0 && features <= MAX_DIMS) {
      const out = new Array<number>(features).fill(0);
      for (let tk = 0; tk < tokens; tk++) {
        for (let f = 0; f < features; f++) out[f] += data[tk * features + f];
      }
      for (let f = 0; f < features; f++) out[f] /= tokens;
      return normalize(out);
    }
  }

  if (data.length > MAX_DIMS) return null;
  return normalize(Array.from(data));
}

function normalize(v: number[]): number[] {
  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm);
  if (!norm) return v;
  return v.map((x) => x / norm);
}

/**
 * Embeds images (data URLs). Returns null if on-device embedding isn't
 * available — the caller then ranks by distance only.
 */
export async function embedImages(dataUrls: string[]): Promise<number[][] | null> {
  if (!embeddingSupported() || dataUrls.length === 0) return null;

  const work = (async (): Promise<number[][] | null> => {
    const extractor = await getExtractor();
    if (!extractor) return null;
    const out: number[][] = [];
    for (const url of dataUrls) {
      try {
        const result = await extractor(url);
        const vec = toVector(result);
        if (vec) out.push(vec);
      } catch {
        /* skip this image */
      }
    }
    return out.length ? out : null;
  })();

  // First run downloads the model; cap it so the UI can always continue.
  return withTimeout<number[][] | null>(work, 90000, null);
}
