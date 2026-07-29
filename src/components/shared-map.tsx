"use client";

import { useMemo } from "react";
import { LocateFixed } from "lucide-react";
import { trpc } from "@/lib/trpc/react";
import { DynamicMap } from "@/components/map/dynamic-map";
import type { MapPin } from "@/components/map/leaflet-map";
import type { Coords } from "@/lib/use-geolocation";
import { useT } from "@/lib/i18n/react";

const DEFAULT_CENTER: [number, number] = [51.5074, -0.1278];

export function SharedMap({
  loc,
  onRequestLocation,
  locationStatus,
}: {
  loc: Coords | null;
  onRequestLocation: () => void;
  locationStatus: string;
}) {
  const t = useT();
  const pinsQuery = trpc.search.mapPins.useQuery({ loc: loc ?? undefined });

  const pins = useMemo<MapPin[]>(() => {
    const dogPins: MapPin[] =
      pinsQuery.data?.map((p) => ({
        id: p.searchId,
        lat: p.lat,
        lng: p.lng,
        emoji: "🐕",
        label: p.name,
        sublabel: p.breed ?? undefined,
        href: `/dogs/${p.dogId}`,
      })) ?? [];
    if (loc) {
      dogPins.push({ id: "me", lat: loc.lat, lng: loc.lng, emoji: "📍", label: t("map.youAreHere") });
    }
    return dogPins;
  }, [pinsQuery.data, loc, t]);

  const center: [number, number] = loc
    ? [loc.lat, loc.lng]
    : pins.length > 0
      ? [pins[0].lat, pins[0].lng]
      : DEFAULT_CENTER;

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <h2 className="font-semibold">{t("map.title")}</h2>
          <p className="text-xs text-[var(--muted)]">
            {t("map.activeNearby", { count: pinsQuery.data?.length ?? 0 })}
          </p>
        </div>
        {!loc && (
          <button className="btn-ghost inline-flex items-center gap-1.5" onClick={onRequestLocation}>
            <LocateFixed className="h-4 w-4" /> {locationStatus === "locating" ? t("report.locating") : t("report.useMyLocation")}
          </button>
        )}
      </div>
      <DynamicMap center={center} zoom={12} pins={pins} fitToData height={340} />
      {locationStatus === "denied" && (
        <p className="px-4 py-2 text-xs text-[var(--muted)]">{t("map.denied")}</p>
      )}
    </div>
  );
}
