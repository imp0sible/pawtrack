"use client";

import { useMemo } from "react";
import { DynamicMap } from "@/components/map/dynamic-map";
import type { MapPin } from "@/components/map/leaflet-map";
import type { Coords } from "@/lib/use-geolocation";

const DEFAULT_CENTER: [number, number] = [51.5074, -0.1278];

export function LocationPicker({
  value,
  onChange,
  userLoc,
  flyTo,
  height = 260,
}: {
  value: Coords | null;
  onChange: (c: Coords) => void;
  userLoc?: Coords | null;
  /** When set (e.g. after "Use my location"), the map animates to this point. */
  flyTo?: [number, number] | null;
  height?: number;
}) {
  const pins = useMemo<MapPin[]>(
    () => (value ? [{ id: "picked", lat: value.lat, lng: value.lng, emoji: "❗", label: "Last seen here" }] : []),
    [value]
  );

  const center: [number, number] = value
    ? [value.lat, value.lng]
    : userLoc
      ? [userLoc.lat, userLoc.lng]
      : DEFAULT_CENTER;

  return (
    <div>
      <DynamicMap
        center={center}
        zoom={14}
        pins={pins}
        height={height}
        flyTo={flyTo}
        onMapClick={(lat, lng) => onChange({ lat, lng })}
      />
      <p className="mt-1 text-xs text-[var(--muted)]">
        {value ? `Selected: ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}` : "Tap the map to mark where the dog was last seen."}
      </p>
    </div>
  );
}
