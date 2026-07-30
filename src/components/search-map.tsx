"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, MapPin, Square, Footprints, Send, Palette, Clock } from "lucide-react";
import { trpc } from "@/lib/trpc/react";
import { DynamicMap } from "@/components/map/dynamic-map";
import type { MapPin as MapPinType, MapPath, MapCircle } from "@/components/map/leaflet-map";
import { useRoomEvents } from "@/lib/use-realtime";
import { POI_META, POI_TYPES, type PoiType } from "@/lib/constants";
import { timeAgo } from "@/lib/format";
import {
  TRACE_COLORS,
  TRACE_FADE_OPTIONS,
  DEFAULT_TRACE_FADE_MINUTES,
  traceOpacity,
} from "@/lib/trace";

interface Sighting { id: string; lat: number; lng: number; note: string | null; seenAt: Date; by: string }
interface Poi { id: string; type: string; lat: number; lng: number; note: string | null }
interface Coverage {
  id: string;
  points: Array<[number, number]>;
  by: string;
  userId: string;
  recordedAt: Date;
  color?: string;
}
interface Participant {
  id: string;
  role: string;
  traceColor: string;
  user: { id: string; name: string };
}

interface Props {
  searchId: string;
  dogId: string;
  active: boolean;
  dogName: string;
  homeLat: number | null;
  homeLng: number | null;
  lastSeen: { lat: number | null; lng: number | null; address: string | null };
  sightings: Sighting[];
  pois: Poi[];
  coverage: Coverage[];
  participants: Participant[];
  meId?: string;
  onChanged: () => void;
}

type AddMode = null | "sighting" | "poi";

const DEFAULT_CENTER: [number, number] = [51.5074, -0.1278];

export function SearchMap(props: Props) {
  const { searchId, active, onChanged } = props;
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;

  const [addMode, setAddMode] = useState<AddMode>(null);
  const [poiType, setPoiType] = useState<PoiType>("FLYER_SPOT");
  const [pending, setPending] = useState<{ lat: number; lng: number } | null>(null);
  const [note, setNote] = useState("");
  const [show, setShow] = useState({ coverage: true, sightings: true, pois: true, places: true });

  // Coverage tracking via geolocation.
  const [tracking, setTracking] = useState(false);
  const [tracked, setTracked] = useState<Array<[number, number]>>([]);
  const [trackStart, setTrackStart] = useState<number | null>(null);
  const watchRef = useRef<number | null>(null);

  useRoomEvents(`search:${searchId}`, {
    "sighting:added": onChanged,
    "poi:added": onChanged,
    "poi:removed": onChanged,
    "coverage:added": onChanged,
  });

  const addSighting = trpc.map.addSighting.useMutation({ onSuccess: reset });
  const addPoi = trpc.map.addPoi.useMutation({ onSuccess: reset });
  const removePoi = trpc.map.removePoi.useMutation({ onSuccess: onChanged });
  const addCoverage = trpc.map.addCoverage.useMutation({ onSuccess: onChanged });

  // Trace fade window (a viewer preference, persisted in settings) and the
  // searcher's own trace colour.
  const utils = trpc.useUtils();
  const settings = trpc.user.getSettings.useQuery();
  const updateSettings = trpc.user.updateSettings.useMutation({
    onSuccess: () => utils.user.getSettings.invalidate(),
  });
  const [colorError, setColorError] = useState<string | null>(null);
  const setTraceColor = trpc.map.setTraceColor.useMutation({
    onSuccess: () => {
      setColorError(null);
      onChanged();
    },
    onError: (e) => setColorError(e.message),
  });

  const fadeMinutes = settings.data?.traceFadeMinutes ?? DEFAULT_TRACE_FADE_MINUTES;
  const myColor = props.meId
    ? props.participants.find((p) => p.user.id === props.meId)?.traceColor
    : undefined;
  const takenColors = new Set(
    props.participants.filter((p) => p.user.id !== props.meId).map((p) => p.traceColor)
  );

  // Traces fade with age, so re-render periodically to keep opacity current
  // (only while a finite fade window is active).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!fadeMinutes) return;
    // Refresh often enough that the fade looks continuous, cheaply.
    const ms = Math.min(30000, Math.max(2000, (fadeMinutes * 60000) / 60));
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [fadeMinutes]);

  function reset() {
    setPending(null);
    setNote("");
    setAddMode(null);
    onChanged();
  }

  function handleMapClick(lat: number, lng: number) {
    if (!addMode || !active) return;
    setPending({ lat, lng });
  }

  function confirmPending() {
    if (!pending) return;
    if (addMode === "sighting") {
      addSighting.mutate({ searchId, lat: pending.lat, lng: pending.lng, note: note || undefined });
    } else if (addMode === "poi") {
      addPoi.mutate({ searchId, type: poiType, lat: pending.lat, lng: pending.lng, note: note || undefined });
    }
  }

  function startTracking() {
    if (!navigator.geolocation) return;
    setTracked([]);
    setTracking(true);
    setTrackStart(Date.now());
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => setTracked((prev) => [...prev, [pos.coords.latitude, pos.coords.longitude]]),
      () => {},
      { enableHighAccuracy: true, maximumAge: 2000 }
    );
  }

  function stopTracking() {
    if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
    setTracking(false);
    const secs = trackStart ? Math.round((Date.now() - trackStart) / 1000) : 0;
    if (tracked.length >= 2) {
      addCoverage.mutate({ searchId, points: tracked, secondsSpent: secs });
    }
    setTracked([]);
    setTrackStart(null);
  }

  const pins = useMemo<MapPinType[]>(() => {
    const out: MapPinType[] = [];
    if (show.places) {
      if (props.lastSeen.lat != null && props.lastSeen.lng != null) {
        out.push({
          id: "last-seen",
          lat: props.lastSeen.lat,
          lng: props.lastSeen.lng,
          emoji: "❗",
          label: "Last seen here",
          sublabel: props.lastSeen.address ?? undefined,
        });
      }
      if (props.homeLat != null && props.homeLng != null) {
        out.push({ id: "home", lat: props.homeLat, lng: props.homeLng, emoji: "🏠", label: `${props.dogName}'s home` });
      }
    }
    if (show.sightings) {
      for (const s of props.sightings) {
        out.push({
          id: `sight-${s.id}`,
          lat: s.lat,
          lng: s.lng,
          emoji: "👀",
          label: `Sighting · ${timeAgo(s.seenAt)}`,
          sublabel: s.note ? `${s.note} — ${s.by}` : `Reported by ${s.by}`,
        });
      }
    }
    if (show.pois) {
      for (const p of props.pois) {
        const meta = POI_META[(p.type as PoiType)] ?? POI_META.OTHER;
        out.push({ id: `poi-${p.id}`, lat: p.lat, lng: p.lng, emoji: meta.icon, label: meta.label, sublabel: p.note ?? undefined });
      }
    }
    if (pending) out.push({ id: "pending", lat: pending.lat, lng: pending.lng, emoji: addMode === "poi" ? POI_META[poiType].icon : "👀" });
    if (tracking && tracked.length) {
      const last = tracked[tracked.length - 1];
      out.push({ id: "tracking", lat: last[0], lng: last[1], emoji: "🟢", label: "You (recording)" });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.sightings, props.pois, props.lastSeen, props.homeLat, props.homeLng, show, pending, addMode, poiType, tracking, tracked]);

  const paths = useMemo<MapPath[]>(() => {
    const out: MapPath[] = [];
    if (show.coverage) {
      for (const c of props.coverage) {
        if (c.points.length < 2) continue;
        // Older traces fade out; skip the ones that have fully vanished.
        const opacity = traceOpacity(c.recordedAt, fadeMinutes, now);
        if (opacity <= 0) continue;
        out.push({ id: `cov-${c.id}`, points: c.points, color: c.color, opacity });
      }
    }
    // The path being recorded right now is always fully visible, in your colour.
    if (tracking && tracked.length >= 2) {
      out.push({ id: "track", points: tracked, color: myColor ?? "#f0a020", opacity: 0.9 });
    }
    return out;
  }, [props.coverage, show.coverage, tracking, tracked, fadeMinutes, now, myColor]);

  const circles = useMemo<MapCircle[]>(() => {
    if (show.places && props.lastSeen.lat != null && props.lastSeen.lng != null) {
      return [{ id: "search-radius", lat: props.lastSeen.lat, lng: props.lastSeen.lng, radiusM: 500, color: "#e0524a" }];
    }
    return [];
  }, [props.lastSeen, show.places]);

  const center: [number, number] =
    props.lastSeen.lat != null && props.lastSeen.lng != null
      ? [props.lastSeen.lat, props.lastSeen.lng]
      : props.homeLat != null && props.homeLng != null
        ? [props.homeLat, props.homeLng]
        : pins[0]
          ? [pins[0].lat, pins[0].lng]
          : DEFAULT_CENTER;

  return (
    <div className="card overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] p-3">
        {active ? (
          <>
            <button
              className={`chip inline-flex items-center gap-1.5 ${addMode === "sighting" ? "chip-active" : ""}`}
              onClick={() => { setAddMode(addMode === "sighting" ? null : "sighting"); setPending(null); }}
            >
              <Eye className="h-3.5 w-3.5" /> Add sighting
            </button>
            <div className="flex items-center gap-1">
              <button
                className={`chip inline-flex items-center gap-1.5 ${addMode === "poi" ? "chip-active" : ""}`}
                onClick={() => { setAddMode(addMode === "poi" ? null : "poi"); setPending(null); }}
              >
                <MapPin className="h-3.5 w-3.5" /> Add place
              </button>
              {addMode === "poi" && (
                <select className="input !w-auto !py-1 text-xs" value={poiType} onChange={(e) => setPoiType(e.target.value as PoiType)}>
                  {POI_TYPES.map((t) => (
                    <option key={t} value={t}>{POI_META[t].label}</option>
                  ))}
                </select>
              )}
            </div>
            {tracking ? (
              <button className="btn-danger inline-flex items-center gap-1.5 !py-1.5 text-xs" onClick={stopTracking}>
                <Square className="h-3.5 w-3.5" /> Stop & save ({tracked.length} pts)
              </button>
            ) : (
              <button className="chip inline-flex items-center gap-1.5" onClick={startTracking}>
                <Footprints className="h-3.5 w-3.5" /> Record my coverage
              </button>
            )}
            {botUsername && (
              <a
                className="chip inline-flex items-center gap-1.5"
                href={`https://t.me/${botUsername}?start=${searchId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Send className="h-3.5 w-3.5" /> Track via Telegram
              </a>
            )}
          </>
        ) : (
          <span className="text-xs text-[var(--muted)]">This search is archived — map is read-only.</span>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
          {(["coverage", "sightings", "pois", "places"] as const).map((k) => (
            <label key={k} className="flex items-center gap-1 capitalize">
              <input type="checkbox" checked={show[k]} onChange={(e) => setShow((s) => ({ ...s, [k]: e.target.checked }))} />
              {k}
            </label>
          ))}
        </div>
      </div>

      {/* Trace appearance: how fast traces fade, and your own trace colour. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--border)] px-3 py-2 text-xs">
        <label className="flex items-center gap-1.5" title="Coverage traces fade out over this long, so you can see what's recent.">
          <Clock className="h-3.5 w-3.5 text-[var(--muted)]" />
          <span className="text-[var(--muted)]">Traces fade after</span>
          <select
            className="input !w-auto !py-1 text-xs"
            value={fadeMinutes}
            onChange={(e) => updateSettings.mutate({ traceFadeMinutes: Number(e.target.value) })}
          >
            {TRACE_FADE_OPTIONS.map((o) => (
              <option key={o.minutes} value={o.minutes}>{o.label}</option>
            ))}
          </select>
        </label>

        {myColor && (
          <div className="flex items-center gap-1.5">
            <Palette className="h-3.5 w-3.5 text-[var(--muted)]" />
            <span className="text-[var(--muted)]">My trace</span>
            <div className="flex flex-wrap items-center gap-1">
              {TRACE_COLORS.map((c) => {
                const taken = takenColors.has(c.hex);
                const isMine = myColor === c.hex;
                return (
                  <button
                    key={c.hex}
                    type="button"
                    title={taken ? `${c.name} — taken by another searcher` : c.name}
                    disabled={taken || setTraceColor.isPending}
                    onClick={() => setTraceColor.mutate({ searchId, color: c.hex })}
                    className="h-5 w-5 rounded-full transition-transform disabled:cursor-not-allowed"
                    style={{
                      background: c.hex,
                      opacity: taken && !isMine ? 0.25 : 1,
                      outline: isMine ? "2px solid var(--foreground)" : "1px solid var(--border)",
                      outlineOffset: isMine ? 2 : 0,
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}
        {colorError && <span className="text-[var(--danger)]">{colorError}</span>}
      </div>

      {addMode && !pending && (
        <div className="bg-[var(--brand-soft)] px-4 py-2 text-sm text-[var(--brand-strong)]">
          Tap the map to place {addMode === "sighting" ? "a sighting" : `a ${POI_META[poiType].label.toLowerCase()}`}.
        </div>
      )}

      <DynamicMap center={center} zoom={14} pins={pins} paths={paths} circles={circles} height={420} onMapClick={handleMapClick} fitToData />

      {/* Pending confirmation */}
      {pending && (
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] p-3">
          <input
            className="input flex-1"
            placeholder={addMode === "sighting" ? "What did you see? (optional)" : "Note (optional)"}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button className="btn-primary" onClick={confirmPending} disabled={addSighting.isPending || addPoi.isPending}>
            Save
          </button>
          <button className="btn-ghost" onClick={() => { setPending(null); setNote(""); }}>Cancel</button>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-[var(--border)] px-4 py-2 text-xs text-[var(--muted)]">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "#e0524a" }} /> Last seen</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "#7c3aed" }} /> Home</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "#f0a020" }} /> Sighting</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "#db2777" }} /> Places</span>
      </div>

      {/* Who's who: each searcher's trace colour. */}
      {props.participants.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-[var(--border)] px-4 py-2 text-xs text-[var(--muted)]">
          <span className="font-medium text-[var(--foreground)]">Traces</span>
          {props.participants.map((p) => (
            <span key={p.id} className="flex items-center gap-1.5">
              <span className="h-1 w-5 rounded-full" style={{ background: p.traceColor }} />
              {p.user.name}
              {p.user.id === props.meId ? " (you)" : ""}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
