"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Polygon,
  Marker,
  useMapEvents,
  Circle,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/**
 * Admin-only polygon zone drawer, built on Leaflet + OSM tiles (free).
 *
 * Interactions:
 *   - Click empty map area → adds a new vertex at the tap point.
 *   - Drag a vertex → moves it (polygon reshapes live).
 *   - Click an existing vertex → removes it. (Polygon needs ≥3 vertices,
 *     so the 4th-vertex click just removes it; clicking a vertex when only
 *     3 remain will drop below the minimum and clear the polygon.)
 *   - "Clear" button in the parent (not here) → passes an empty array.
 *
 * The parent controls `polygon` state and the callback fires on every change.
 *
 * The `center` + `radiusKm` inputs draw a reference circle so the admin
 * can see what the fallback zone would be if they clear the polygon.
 *
 * IMPORTANT: import via `next/dynamic({ ssr: false })` — Leaflet reads
 * `window` at import time.
 */
interface DeliveryPolygonDrawerProps {
  polygon: [number, number][]; // [[lng, lat], ...]
  onChange: (poly: [number, number][]) => void;
  center: { lat: number; lng: number };
  radiusKm: number;
  className?: string;
}

const vertexIcon = L.divIcon({
  html: `<div style="
    width:16px;height:16px;border-radius:50%;
    background:#059669;border:3px solid #ffffff;
    box-shadow:0 1px 4px rgba(0,0,0,0.4);
  "></div>`,
  className: "polygon-vertex",
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function ClickCatcher({
  onAdd,
}: {
  onAdd: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onAdd(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function DeliveryPolygonDrawer({
  polygon,
  onChange,
  center,
  radiusKm,
  className,
}: DeliveryPolygonDrawerProps) {
  // Leaflet Polygon wants [lat, lng]; we store [lng, lat] (GeoJSON).
  const positions = useMemo<[number, number][]>(
    () => polygon.map(([lng, lat]) => [lat, lng]),
    [polygon]
  );

  const markerRefs = useRef<Record<number, L.Marker | null>>({});

  const addVertex = (lat: number, lng: number) => {
    onChange([...polygon, [lng, lat]]);
  };

  const moveVertex = (idx: number, lat: number, lng: number) => {
    const next = polygon.slice();
    next[idx] = [lng, lat];
    onChange(next);
  };

  const removeVertex = (idx: number) => {
    const next = polygon.filter((_, i) => i !== idx);
    onChange(next);
  };

  return (
    <div
      className={
        className ?? "h-72 w-full overflow-hidden rounded-2xl border border-slate-800"
      }
    >
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={14}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        {/* Reference: circular radius zone (dashed) */}
        <Circle
          center={[center.lat, center.lng]}
          radius={radiusKm * 1000}
          pathOptions={{
            color: "#64748b",
            weight: 1,
            dashArray: "6 6",
            fillOpacity: 0.04,
          }}
        />

        {/* The drawn polygon (only shown once ≥3 vertices) */}
        {positions.length >= 3 && (
          <Polygon
            positions={positions}
            pathOptions={{
              color: "#059669",
              weight: 2,
              fillColor: "#059669",
              fillOpacity: 0.18,
            }}
          />
        )}

        {/* Each vertex — draggable + click-to-delete */}
        {positions.map((pos, idx) => (
          <Marker
            key={idx}
            position={pos}
            icon={vertexIcon}
            draggable
            eventHandlers={{
              click: () => removeVertex(idx),
              dragend: () => {
                const m = markerRefs.current[idx];
                if (!m) return;
                const p = m.getLatLng();
                moveVertex(idx, p.lat, p.lng);
              },
            }}
            ref={(m) => {
              markerRefs.current[idx] = m as L.Marker | null;
            }}
          />
        ))}

        <ClickCatcher onAdd={addVertex} />
      </MapContainer>
    </div>
  );
}
