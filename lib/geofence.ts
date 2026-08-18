/**
 * Single-store (or multi-store) serviceability & geofencing.
 *
 * FLEXIBLE CONFIGURATION — every knob below can be overridden by env vars,
 * so the store owner (or an admin API later) can change the radius without
 * a code change:
 *
 *   STORE_ID            (default: "STORE_PARADIP_MAIN")
 *   STORE_NAME          (default: "Satyug 10-Minute Store · Paradip")
 *   STORE_LAT           (default: 20.287694  — 20°17'15.7"N)
 *   STORE_LNG           (default: 86.609111  — 86°36'32.8"E)
 *   DELIVERY_RADIUS_KM  (default: 3)         — accepts decimals like "2.5"
 *   DELIVERY_ETA_MINUTES(default: 10)
 *   GEOFENCE_SIDES      (default: 64)        — polygon vertex count
 *
 * Multi-store: set STORES_JSON to a JSON array of {id,name,lat,lng,radiusKm,etaMinutes}
 * and the check will find the nearest serviceable store. Single-store is the
 * default when STORES_JSON is unset.
 *
 * Everything is computed lazily so a runtime env change (via /api/admin/store
 * later) can be picked up without a restart — see `getStores()`.
 */

// ─── Types ──────────────────────────────────────────────────────
export interface StoreConfig {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusKm: number;
  etaMinutes: number;
}

export interface ServiceabilityResult {
  serviceable: boolean;
  store_id: string;
  store_name: string;
  distance_km: number;
  radius_km: number;
  eta_minutes: number | null;
  center: { lat: number; lng: number };
  reason?: "out_of_zone" | "invalid_coords";
}

// ─── Env parsing ────────────────────────────────────────────────
const num = (v: string | undefined, fallback: number): number => {
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

function defaultStore(): StoreConfig {
  return {
    id: process.env.STORE_ID || "STORE_PARADIP_MAIN",
    name: process.env.STORE_NAME || "Satyug 10-Minute Store · Paradip",
    // Exact dark-store GPS pin — measured on-site.
    lat: num(process.env.STORE_LAT, 20.2876869),
    lng: num(process.env.STORE_LNG, 86.6091121),
    radiusKm: num(process.env.DELIVERY_RADIUS_KM, 3),
    etaMinutes: num(process.env.DELIVERY_ETA_MINUTES, 10),
  };
}

/** Runtime accessor — call this instead of the top-level exports if you're
 *  worried about mid-process env mutation (e.g. an admin API updating radius). */
export function getStores(): StoreConfig[] {
  const raw = process.env.STORES_JSON?.trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as StoreConfig[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (err) {
      console.warn("[geofence] STORES_JSON is invalid, using single-store default:", err);
    }
  }
  return [defaultStore()];
}

// ─── Legacy single-store exports (still populated at module load) ────────
const _initial = defaultStore();
export const STORE_ID = _initial.id;
export const STORE_NAME = _initial.name;
export const STORE_CENTER = { lat: _initial.lat, lng: _initial.lng };
export const DELIVERY_RADIUS_KM = _initial.radiusKm;
export const DELIVERY_ETA_MINUTES = _initial.etaMinutes;
export const GEOFENCE_CENTER = {
  lat: _initial.lat,
  lng: _initial.lng,
  storeId: _initial.id,
  storeName: _initial.name,
  radiusKm: _initial.radiusKm,
  etaMinutes: _initial.etaMinutes,
} as const;
const _sides = Math.max(8, Math.min(256, Math.round(num(process.env.GEOFENCE_SIDES, 64))));

// ─── Geometry ────────────────────────────────────────────────────
const EARTH_RADIUS_KM = 6371;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/** Great-circle distance in km. */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Destination point along a great circle from center at bearing (deg from N, clockwise). */
function pointAtBearing(
  center: { lat: number; lng: number },
  radiusKm: number,
  bearingDeg: number
): [number, number] {
  const δ = radiusKm / EARTH_RADIUS_KM;
  const θ = toRad(bearingDeg);
  const φ1 = toRad(center.lat);
  const λ1 = toRad(center.lng);
  const sinφ2 = Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ);
  const φ2 = Math.asin(sinφ2);
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * sinφ2
    );
  const lng = ((toDeg(λ2) + 540) % 360) - 180;
  return [lng, toDeg(φ2)]; // GeoJSON order: [lng, lat]
}

/** N-vertex approximation of a circle, closed as a GeoJSON linear ring. */
export function generateCirclePolygon(
  center: { lat: number; lng: number },
  radiusKm: number,
  sides = _sides
): [number, number][] {
  const ring: [number, number][] = [];
  for (let i = 0; i < sides; i++) {
    ring.push(pointAtBearing(center, radiusKm, (i * 360) / sides));
  }
  ring.push(ring[0]);
  return ring;
}

/** Ray-casting PIP on GeoJSON `[lng, lat][]` ring. */
export function isPointInPolygon(
  point: { lat: number; lng: number },
  polygon: [number, number][]
): boolean {
  let inside = false;
  const { lng: x, lat: y } = point;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// ─── Ready-to-use exports for the CURRENT default store ─────────
export const DELIVERY_POLYGON: [number, number][] = generateCirclePolygon(
  STORE_CENTER,
  DELIVERY_RADIUS_KM,
  _sides
);

export const DELIVERY_GEOJSON = {
  type: "Feature" as const,
  properties: {
    store_id: STORE_ID,
    store_name: STORE_NAME,
    radius_km: DELIVERY_RADIUS_KM,
    center: [STORE_CENTER.lng, STORE_CENTER.lat],
  },
  geometry: { type: "Polygon" as const, coordinates: [DELIVERY_POLYGON] },
};

/** Build a GeoJSON polygon for an arbitrary store — for the admin map UI. */
export function storeGeoJSON(store: StoreConfig) {
  const ring = generateCirclePolygon({ lat: store.lat, lng: store.lng }, store.radiusKm);
  return {
    type: "Feature" as const,
    properties: {
      store_id: store.id,
      store_name: store.name,
      radius_km: store.radiusKm,
      eta_minutes: store.etaMinutes,
      center: [store.lng, store.lat],
    },
    geometry: { type: "Polygon" as const, coordinates: [ring] },
  };
}

// ─── The one function every caller (API + client) uses ─────────
/**
 * Check whether (lat, lng) is inside ANY configured store's delivery zone.
 * Returns the closest serviceable store. Belt-and-suspenders: uses BOTH the
 * polygon (ray casting) and the radius (Haversine) — either satisfies.
 */
export function checkServiceability(lat: number, lng: number): ServiceabilityResult {
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  ) {
    const s = getStores()[0];
    return {
      serviceable: false,
      store_id: s.id,
      store_name: s.name,
      distance_km: Infinity,
      radius_km: s.radiusKm,
      eta_minutes: null,
      center: { lat: s.lat, lng: s.lng },
      reason: "invalid_coords",
    };
  }

  const stores = getStores();
  let best: { store: StoreConfig; distance: number; inside: boolean } | null = null;

  for (const store of stores) {
    const distance = haversineKm({ lat: store.lat, lng: store.lng }, { lat, lng });
    const polygon = generateCirclePolygon(
      { lat: store.lat, lng: store.lng },
      store.radiusKm
    );
    const insidePolygon = isPointInPolygon({ lat, lng }, polygon);
    const insideRadius = distance <= store.radiusKm;
    const inside = insidePolygon || insideRadius;

    // Prefer any serviceable store; among those, the closest by distance.
    if (
      best == null ||
      (inside && !best.inside) ||
      (inside === best.inside && distance < best.distance)
    ) {
      best = { store, distance, inside };
    }
  }

  const { store, distance, inside } = best!;
  return {
    serviceable: inside,
    store_id: store.id,
    store_name: store.name,
    distance_km: Math.round(distance * 100) / 100,
    radius_km: store.radiusKm,
    eta_minutes: inside ? store.etaMinutes : null,
    center: { lat: store.lat, lng: store.lng },
    ...(inside ? {} : { reason: "out_of_zone" as const }),
  };
}
