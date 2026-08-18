"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/**
 * Draggable-pin mini-map for address confirmation (Blinkit-style).
 *
 * Uses OpenStreetMap tiles — FREE, no API key, no signup. Respect their
 * usage policy: don't heavy-load tiles or scrape them.
 *
 * NOTE: Load this component with `next/dynamic({ ssr: false })` from parent —
 * Leaflet accesses `window` at import time and breaks SSR.
 */

interface AddressPinMapProps {
  lat: number;
  lng: number;
  /** Fires when the marker is dragged to a new position. Debounced by the parent. */
  onMove: (lat: number, lng: number) => void;
  className?: string;
}

// Leaflet's default marker icon uses absolute /images paths bundled with the
// npm package — those 404 in Next. Use a data-URI SVG pin so it always renders.
const pinIcon = L.divIcon({
  html: `<div style="
    width: 32px; height: 40px;
    display: flex; align-items: center; justify-content: center;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.35));
  ">
    <svg viewBox="0 0 32 40" width="32" height="40" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 0C7.164 0 0 7.164 0 16c0 12 16 24 16 24s16-12 16-24C32 7.164 24.836 0 16 0z" fill="#059669"/>
      <circle cx="16" cy="16" r="6" fill="#ffffff"/>
    </svg>
  </div>`,
  className: "satyug-map-pin",
  iconSize: [32, 40],
  iconAnchor: [16, 40],
});

// A small child helper: whenever center-lat/lng changes, recenter the map view.
function ReCenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom(), { animate: true });
  }, [lat, lng, map]);
  return null;
}

export default function AddressPinMap({
  lat,
  lng,
  onMove,
  className,
}: AddressPinMapProps) {
  const markerRef = useRef<L.Marker | null>(null);

  return (
    <div
      className={
        className ?? "h-48 w-full overflow-hidden rounded-2xl border border-slate-200"
      }
    >
      <MapContainer
        center={[lat, lng]}
        zoom={17}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
        // Keep touch controls; only disable scroll-wheel zoom to prevent
        // accidental zooming while the parent form is being scrolled.
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <Marker
          position={[lat, lng]}
          icon={pinIcon}
          draggable
          eventHandlers={{
            dragend: () => {
              const m = markerRef.current;
              if (!m) return;
              const p = m.getLatLng();
              onMove(p.lat, p.lng);
            },
          }}
          ref={(m) => {
            markerRef.current = m as L.Marker | null;
          }}
        />
        <ReCenter lat={lat} lng={lng} />
      </MapContainer>
    </div>
  );
}
