"use client";

import dynamic from "next/dynamic";
import type { LeafletMapProps } from "@/components/map/leaflet-map";

// Leaflet touches `window`, so it must never render on the server.
export const DynamicMap = dynamic(
  () => import("@/components/map/leaflet-map").then((m) => m.LeafletMap),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-sm text-[var(--muted)]"
        style={{ height: 360, width: "100%" }}
      >
        Loading map…
      </div>
    ),
  }
);

export type { LeafletMapProps };
