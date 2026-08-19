"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { loadGoogleMaps, GOOGLE_MAPS_BROWSER_KEY } from "@/lib/googleMaps";

/**
 * Admin-only delivery-zone polygon editor built on the Google Maps JS API.
 *
 * Interactions:
 *   - Click empty map area  → adds a new vertex at the tap point.
 *   - Drag a vertex handle  → moves it (polygon reshapes live).
 *   - Right-click a vertex  → removes it. (Polygon needs ≥3 vertices; we
 *     silently allow going below and simply hide the polygon fill until
 *     ≥3 vertices exist again.)
 *
 * The reference circle drawn with `center` + `radiusKm` shows the fallback
 * radius zone that applies when the polygon is cleared.
 *
 * Requires NEXT_PUBLIC_GOOGLE_MAPS_API_KEY with "Maps JavaScript API" +
 * "Drawing library" enabled. When the key is missing we render a helpful
 * placeholder so the settings page still boots.
 */
interface DeliveryPolygonDrawerProps {
  polygon: [number, number][]; // [[lng, lat], ...] — GeoJSON order
  onChange: (poly: [number, number][]) => void;
  center: { lat: number; lng: number };
  radiusKm: number;
  className?: string;
}

export default function DeliveryPolygonDrawer({
  polygon,
  onChange,
  center,
  radiusKm,
  className,
}: DeliveryPolygonDrawerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const polygonRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const listenersRef = useRef<any[]>([]);
  const onChangeRef = useRef(onChange);
  // Suppress reacting to polygon path events triggered by our own props sync.
  const isSyncingRef = useRef(false);
  const [error, setError] = useState<string | null>(
    GOOGLE_MAPS_BROWSER_KEY
      ? null
      : "Map disabled: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set."
  );

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Init map + polygon once
  useEffect(() => {
    if (!containerRef.current || !GOOGLE_MAPS_BROWSER_KEY) return;
    let cancelled = false;

    loadGoogleMaps(["drawing", "geometry"])
      .then((google) => {
        if (cancelled || !containerRef.current) return;

        const map = new google.maps.Map(containerRef.current, {
          center,
          zoom: 14,
          gestureHandling: "greedy",
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        });
        mapRef.current = map;

        // Reference radius fallback zone (dashed)
        circleRef.current = new google.maps.Circle({
          map,
          center,
          radius: radiusKm * 1000,
          strokeColor: "#64748b",
          strokeOpacity: 0.9,
          strokeWeight: 1,
          fillOpacity: 0.04,
          clickable: false,
          // Google doesn't support dash arrays natively on Circle — this is
          // the closest visual approximation without pulling in Symbol paths.
        });

        // Editable polygon — start with what the parent gave us.
        polygonRef.current = new google.maps.Polygon({
          map,
          paths: polygon.map(([lng, lat]) => ({ lat, lng })),
          strokeColor: "#059669",
          strokeWeight: 2,
          fillColor: "#059669",
          fillOpacity: 0.18,
          editable: true,
          draggable: false,
          clickable: true,
        });

        // Right-click on a vertex removes it.
        polygonRef.current.addListener("rightclick", (e: any) => {
          if (e.vertex == null) return;
          const path = polygonRef.current.getPath();
          if (path.getLength() <= 0) return;
          path.removeAt(e.vertex);
        });

        // Clicks on empty map area add a new vertex.
        listenersRef.current.push(
          map.addListener("click", (e: any) => {
            if (!e?.latLng) return;
            const path = polygonRef.current.getPath();
            path.push(e.latLng);
          })
        );

        // Any change to the polygon's path emits back to the parent as
        // [lng, lat] tuples (GeoJSON ordering — same as the DB).
        const emit = () => {
          if (isSyncingRef.current) return;
          const path = polygonRef.current.getPath();
          const next: [number, number][] = [];
          for (let i = 0; i < path.getLength(); i++) {
            const p = path.getAt(i);
            next.push([p.lng(), p.lat()]);
          }
          onChangeRef.current(next);
        };

        const path = polygonRef.current.getPath();
        listenersRef.current.push(path.addListener("set_at", emit));
        listenersRef.current.push(path.addListener("insert_at", emit));
        listenersRef.current.push(path.addListener("remove_at", emit));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message ?? "Failed to load Google Maps");
      });

    return () => {
      cancelled = true;
      listenersRef.current.forEach((l) => {
        try {
          l.remove?.();
        } catch {}
      });
      listenersRef.current = [];
      polygonRef.current?.setMap(null);
      circleRef.current?.setMap(null);
      mapRef.current = null;
    };
    // Intentionally init-once; subsequent prop updates handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync incoming polygon prop (e.g. Clear button, or an external reset)
  // into the map without re-creating the map instance.
  useEffect(() => {
    const poly = polygonRef.current;
    if (!poly) return;
    const path = poly.getPath();
    // Compare quickly to avoid clobbering a live edit.
    const current: [number, number][] = [];
    for (let i = 0; i < path.getLength(); i++) {
      const p = path.getAt(i);
      current.push([p.lng(), p.lat()]);
    }
    const same =
      current.length === polygon.length &&
      current.every(([lng, lat], i) => lng === polygon[i][0] && lat === polygon[i][1]);
    if (same) return;

    isSyncingRef.current = true;
    poly.setPath(polygon.map(([lng, lat]) => ({ lat, lng })));
    isSyncingRef.current = false;
  }, [polygon]);

  // Sync the reference circle when center / radius change.
  useEffect(() => {
    const circle = circleRef.current;
    const map = mapRef.current;
    if (!circle || !map) return;
    circle.setCenter(center);
    circle.setRadius(radiusKm * 1000);
    map.panTo(center);
  }, [center.lat, center.lng, radiusKm]);

  const wrapperClass =
    className ?? "h-72 w-full overflow-hidden rounded-2xl border border-slate-800 relative";

  if (error) {
    return (
      <div
        className={`${wrapperClass} flex flex-col items-center justify-center gap-1.5 bg-slate-950 text-center px-4`}
      >
        <AlertCircle className="h-5 w-5 text-amber-400" />
        <p className="text-[11px] font-bold text-slate-200">Map unavailable</p>
        <p className="text-[10px] text-slate-400 leading-snug">{error}</p>
      </div>
    );
  }

  return <div ref={containerRef} className={wrapperClass} />;
}
