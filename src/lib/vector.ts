// Cosine similarity over image-embedding vectors, used to rank candidate
// lost-dog listings against a photo of a street dog.

export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Best similarity across every photo pair (listings can have several photos). */
export function bestSimilarity(query: number[], candidates: number[][]): number | null {
  let best: number | null = null;
  for (const c of candidates) {
    const s = cosineSimilarity(query, c);
    if (best === null || s > best) best = s;
  }
  return best;
}

export type MatchBand = "strong" | "possible" | "weak";

// Heuristic thresholds — deliberately conservative, and shown as bands rather
// than a fake-precise percentage.
export function bandFor(similarity: number): MatchBand {
  if (similarity >= 0.9) return "strong";
  if (similarity >= 0.78) return "possible";
  return "weak";
}

export function parseVectors(json: string | null | undefined): number[][] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is number[] => Array.isArray(v) && v.every((n) => typeof n === "number"));
  } catch {
    return [];
  }
}
