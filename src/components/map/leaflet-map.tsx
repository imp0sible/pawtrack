"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  Circle,
  useMap,
  useMapEvents,
  LayersControl,
} from "react-leaflet";

export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  emoji: string;
  label?: string;
  sublabel?: string;
  href?: string;
}

export interface MapPath {
  id: string;
  points: Array<[number, number]>;
  color?: string;
  /** 0–1; used for the time-based fade of coverage traces. */
  opacity?: number;
}

export interface MapCircle {
  id: string;
  lat: number;
  lng: number;
  radiusM: number;
  color?: string;
  label?: string;
}

export interface LeafletMapProps {
  center: [number, number];
  zoom?: number;
  pins?: MapPin[];
  paths?: MapPath[];
  circles?: MapCircle[];
  height?: number | string;
  onMapClick?: (lat: number, lng: number) => void;
  fitToData?: boolean;
  /** When this changes to a coordinate, the map animates to center on it. */
  flyTo?: [number, number] | null;
  className?: string;
}

// White glyphs (16px, viewBox 24) used inside the colored marker badges.
const G = {
  paw: `<svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><ellipse cx="6" cy="11" rx="2" ry="2.6"/><ellipse cx="10" cy="8" rx="2" ry="2.7"/><ellipse cx="14" cy="8" rx="2" ry="2.7"/><ellipse cx="18" cy="11" rx="2" ry="2.6"/><path d="M12 12c3 0 5.5 2.2 5.5 4.6 0 2.3-2.4 3.4-5.5 3.4s-5.5-1.1-5.5-3.4C6.5 14.2 9 12 12 12z"/></svg>`,
  pin: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-5.686 7-11a7 7 0 1 0-14 0c0 5.314 7 11 7 11Z"/><circle cx="12" cy="10" r="2.4"/></svg>`,
  home: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11 12 4l8 7"/><path d="M6 10v9h12v-9"/></svg>`,
  eye: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="2.4"/></svg>`,
  alert: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4 3 19h18L12 4Z"/><path d="M12 10v4"/><path d="M12 17h.01"/></svg>`,
  trash: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M9 7V5h6v2"/><path d="M6.5 7 7.5 20h9l1-13"/></svg>`,
  store: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 10H19.5V19H4.5z"/><path d="M4 10 5.5 5h13L20 10"/></svg>`,
  dot: `<svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><circle cx="12" cy="12" r="5.5"/></svg>`,
};

const MARKERS: Record<string, { bg: string; svg: string }> = {
  "🐕": { bg: "#0e9f6e", svg: G.paw },
  "📍": { bg: "#2563eb", svg: G.pin },
  "❗": { bg: "#e0524a", svg: G.alert },
  "🏠": { bg: "#7c3aed", svg: G.home },
  "👀": { bg: "#f0a020", svg: G.eye },
  "🗑️": { bg: "#64748b", svg: G.trash },
  "🏪": { bg: "#0d9488", svg: G.store },
  "📌": { bg: "#db2777", svg: G.pin },
  "🟢": { bg: "#16a34a", svg: G.dot },
};

function emojiIcon(emoji: string) {
  const m = MARKERS[emoji];
  const inner = m
    ? m.svg
    : `<span style="font-size:15px;line-height:1">${emoji}</span>`;
  const bg = m ? m.bg : "#0e9f6e";
  return L.divIcon({
    className: "",
    html: `<div style="width:28px;height:28px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45)">${inner}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

function ClickHandler({ onMapClick }: { onMapClick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick?.(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FlyTo({ target, zoom }: { target?: [number, number] | null; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    // Instant setView (animate:false) is used deliberately: an animated flyTo /
    // panning setView can be interrupted by the concurrent re-render that
    // updates the pins, leaving the map stuck at its previous center.
    map.setView(target, Math.max(map.getZoom(), zoom ?? 15), { animate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.[0], target?.[1]]);
  return null;
}

function FitBounds({ pins, paths, circles }: { pins: MapPin[]; paths: MapPath[]; circles: MapCircle[] }) {
  const map = useMap();
  useEffect(() => {
    const pts: Array<[number, number]> = [];
    pins.forEach((p) => pts.push([p.lat, p.lng]));
    paths.forEach((pa) => pa.points.forEach((pt) => pts.push(pt)));
    circles.forEach((c) => pts.push([c.lat, c.lng]));
    if (pts.length === 0) return;
    if (pts.length === 1) {
      map.setView(pts[0], Math.max(map.getZoom(), 14));
      return;
    }
    map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 16 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(pins.map((p) => p.id)), JSON.stringify(paths.map((p) => p.id)), JSON.stringify(circles.map((c) => c.id))]);
  return null;
}

export function LeafletMap({
  center,
  zoom = 13,
  pins = [],
  paths = [],
  circles = [],
  height = 360,
  onMapClick,
  fitToData = false,
  flyTo,
  className,
}: LeafletMapProps) {
  const icons = useMemo(() => {
    const cache = new Map<string, L.DivIcon>();
    for (const p of pins) if (!cache.has(p.emoji)) cache.set(p.emoji, emojiIcon(p.emoji));
    return cache;
  }, [pins]);

  return (
    <div className={className} style={{ height, width: "100%" }}>
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom
        style={{ height: "100%", width: "100%", borderRadius: 16 }}
      >
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Street">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              subdomains="abcd"
              maxZoom={20}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellite">
            <TileLayer
              attribution='Tiles &copy; <a href="https://www.esri.com">Esri</a> — Source: Esri, Maxar, Earthstar Geographics'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
            />
          </LayersControl.BaseLayer>
        </LayersControl>
        <ClickHandler onMapClick={onMapClick} />
        {fitToData && <FitBounds pins={pins} paths={paths} circles={circles} />}
        <FlyTo target={flyTo} zoom={zoom} />

        {circles.map((c) => (
          <Circle
            key={c.id}
            center={[c.lat, c.lng]}
            radius={c.radiusM}
            pathOptions={{ color: c.color ?? "#0e9f6e", fillOpacity: 0.12, weight: 1 }}
          />
        ))}

        {paths.map((p) => (
          <Polyline
            key={p.id}
            positions={p.points}
            pathOptions={{ color: p.color ?? "#0e9f6e", weight: 5, opacity: p.opacity ?? 0.55 }}
          />
        ))}

        {pins.map((p) => (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={icons.get(p.emoji)}>
            {(p.label || p.sublabel || p.href) && (
              <Popup>
                {p.label && <div className="font-semibold">{p.label}</div>}
                {p.sublabel && <div className="text-xs opacity-70">{p.sublabel}</div>}
                {p.href && (
                  <a href={p.href} className="text-xs font-semibold" style={{ color: "#057a51" }}>
                    Open →
                  </a>
                )}
              </Popup>
            )}
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
