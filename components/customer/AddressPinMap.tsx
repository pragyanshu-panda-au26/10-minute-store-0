"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { loadGoogleMaps, GOOGLE_MAPS_BROWSER_KEY } from "@/lib/googleMaps";

/**
 * Draggable-pin mini-map for address confirmation (Blinkit-style).
 *
 * Uses the Google Maps JavaScript API. Requires NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
 * with "Maps JavaScript API" enabled. When the key is missing (e.g. local dev
 * on a fresh clone) the component renders a helpful placeholder instead of
 * throwing — the surrounding address form still works, just without the map.
 *
 * NOTE: this file still loads client-side only; the loader guards SSR.
 */

interface AddressPinMapProps {
  lat: number;
  lng: number;
  /** Fires when the marker is dragged to a new position. Parent debounces. */
  onMove: (lat: number, lng: number) => void;
  className?: string;
}

// Custom teardrop SVG matched to the emerald pin used elsewhere in the app.
const PIN_SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 40" width="32" height="40">
       <path d="M16 0C7.164 0 0 7.164 0 16c0 12 16 24 16 24s16-12 16-24C32 7.164 24.836 0 16 0z" fill="#059669"/>
       <circle cx="16" cy="16" r="6" fill="#ffffff"/>
     </svg>`
  );

export default function AddressPinMap({
  lat,
  lng,
  onMove,
  className,
}: AddressPinMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const onMoveRef = useRef(onMove);
  // Track the last known pin position so React prop updates that echo back
  // from an internal marker drag don't cause a redundant setPosition().
  const lastPosRef = useRef({ lat, lng });
  const [error, setError] = useState<string | null>(
    GOOGLE_MAPS_BROWSER_KEY ? null : "Map disabled: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set."
  );

  // Keep the latest onMove reference without re-initializing the map.
  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  // Init the map exactly once when the container is mounted + key is present.
  useEffect(() => {
    if (!containerRef.current || !GOOGLE_MAPS_BROWSER_KEY) return;
    let cancelled = false;

    loadGoogleMaps()
      .then((google) => {
        if (cancelled || !containerRef.current) return;
        const map = new google.maps.Map(containerRef.current, {
          center: { lat, lng },
          zoom: 17,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy",
          clickableIcons: false,
          keyboardShortcuts: false,
        });

        const marker = new google.maps.Marker({
          position: { lat, lng },
          map,
          draggable: true,
          icon: {
            url: PIN_SVG,
            scaledSize: new google.maps.Size(32, 40),
            anchor: new google.maps.Point(16, 40),
          },
        });

        // Tapping the map moves the pin too — matches Blinkit / Zomato UX.
        map.addListener("click", (e: any) => {
          if (!e?.latLng) return;
          const p = { lat: e.latLng.lat(), lng: e.latLng.lng() };
          marker.setPosition(p);
          lastPosRef.current = p;
          onMoveRef.current(p.lat, p.lng);
        });

        marker.addListener("dragend", () => {
          const p = marker.getPosition();
          if (!p) return;
          const pos = { lat: p.lat(), lng: p.lng() };
          lastPosRef.current = pos;
          onMoveRef.current(pos.lat, pos.lng);
        });

        mapRef.current = map;
        markerRef.current = marker;
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message ?? "Failed to load Google Maps");
      });

    return () => {
      cancelled = true;
    };
    // Intentionally NOT depending on lat/lng — we drive the marker in the
    // effect below so a parent prop change doesn't rebuild the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recenter + reposition marker when parent lat/lng changes.
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    const last = lastPosRef.current;
    // Skip if this update is just echoing the position the pin already has —
    // saves a Google-side pan and prevents feedback loops.
    if (Math.abs(last.lat - lat) < 1e-8 && Math.abs(last.lng - lng) < 1e-8) return;
    marker.setPosition({ lat, lng });
    map.panTo({ lat, lng });
    lastPosRef.current = { lat, lng };
  }, [lat, lng]);

  const wrapperClass =
    className ?? "h-48 w-full overflow-hidden rounded-2xl border border-slate-200 relative";

  if (error) {
    return (
      <div
        className={`${wrapperClass} flex flex-col items-center justify-center gap-1.5 bg-slate-50 text-center px-4`}
      >
        <AlertCircle className="h-5 w-5 text-amber-500" />
        <p className="text-[11px] font-bold text-slate-700">Map unavailable</p>
        <p className="text-[10px] text-slate-500 leading-snug">{error}</p>
      </div>
    );
  }

  return <div ref={containerRef} className={wrapperClass} />;
}
