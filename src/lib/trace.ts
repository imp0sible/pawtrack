// Coverage-trace appearance: per-searcher colours and time-based fading.
//
// A trace fades out as it ages, so a fresh path (the dog was moving here just
// now) reads strongly while an old one has visibly gone stale. The fade window
// is a viewer preference (UserSettings.traceFadeMinutes; 0 = never fade).

export interface TraceColor {
  hex: string;
  name: string;
}

// Distinct, readable on both street and satellite tiles, and distinguishable
// from the marker colours. Order matters: colours are handed out top-down.
export const TRACE_COLORS: TraceColor[] = [
  { hex: "#0e9f6e", name: "Green" },
  { hex: "#2563eb", name: "Blue" },
  { hex: "#f0a020", name: "Amber" },
  { hex: "#db2777", name: "Pink" },
  { hex: "#7c3aed", name: "Violet" },
  { hex: "#0d9488", name: "Teal" },
  { hex: "#dc2626", name: "Red" },
  { hex: "#65a30d", name: "Lime" },
  { hex: "#0891b2", name: "Cyan" },
  { hex: "#ea580c", name: "Orange" },
];

export const TRACE_COLOR_HEXES = TRACE_COLORS.map((c) => c.hex);

export function isTraceColor(hex: string): boolean {
  return TRACE_COLOR_HEXES.includes(hex);
}

// Fade-window choices offered in the UI. 0 = all time (no fading).
export const TRACE_FADE_OPTIONS: Array<{ minutes: number; label: string }> = [
  { minutes: 30, label: "30 min" },
  { minutes: 60, label: "1 hour" },
  { minutes: 180, label: "3 hours" },
  { minutes: 360, label: "6 hours" },
  { minutes: 1440, label: "24 hours" },
  { minutes: 0, label: "All time" },
];

export const DEFAULT_TRACE_FADE_MINUTES = 30;

// First palette colour not already used in this search, so two searchers can
// never share one. Falls back to cycling once the palette is exhausted (the
// DB's per-search unique index is the final guard).
export function pickTraceColor(used: Array<string | null | undefined>): string {
  const taken = new Set(used.filter(Boolean) as string[]);
  const free = TRACE_COLOR_HEXES.find((hex) => !taken.has(hex));
  return free ?? TRACE_COLOR_HEXES[taken.size % TRACE_COLOR_HEXES.length];
}

// Stable fallback colour for older participants that never got one assigned.
export function fallbackTraceColor(index: number): string {
  return TRACE_COLOR_HEXES[index % TRACE_COLOR_HEXES.length];
}

const MAX_OPACITY = 0.8;

// Opacity for a trace recorded at `recordedAt`, given the fade window. Fades
// linearly and reaches exactly 0 at the end of the window, so the caller can
// skip drawing anything that has fully vanished.
export function traceOpacity(recordedAt: Date | string, fadeMinutes: number, now: number = Date.now()): number {
  if (!fadeMinutes || fadeMinutes <= 0) return MAX_OPACITY; // "all time"
  const ts = typeof recordedAt === "string" ? Date.parse(recordedAt) : recordedAt.getTime();
  if (!Number.isFinite(ts)) return MAX_OPACITY;
  const ageMin = (now - ts) / 60000;
  if (ageMin <= 0) return MAX_OPACITY;
  const remaining = 1 - ageMin / fadeMinutes;
  return remaining > 0 ? MAX_OPACITY * remaining : 0;
}
