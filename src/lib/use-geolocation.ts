"use client";

import { useCallback, useEffect, useState } from "react";

export interface Coords {
  lat: number;
  lng: number;
}

const STORAGE_KEY = "pawtrack:lastLoc";

export function useGeolocation(auto = true) {
  const [loc, setLoc] = useState<Coords | null>(null);
  const [status, setStatus] = useState<"idle" | "locating" | "granted" | "denied" | "unavailable">("idle");

  const request = useCallback((onSuccess?: (c: Coords) => void) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unavailable");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLoc(next);
        setStatus("granted");
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {}
        // Guard: some callers wire onClick={request}, passing an event here.
        if (typeof onSuccess === "function") onSuccess(next);
      },
      () => setStatus("denied"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  useEffect(() => {
    // Seed from last known location for a fast first paint.
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) setLoc(JSON.parse(cached));
    } catch {}
    if (auto) request();
  }, [auto, request]);

  return { loc, status, request };
}
