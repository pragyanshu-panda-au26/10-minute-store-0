import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fail, handleOptions, handler, ok, parseJson } from "@/lib/api";
import {
  checkServiceability,
  getStores,
  storeGeoJSON,
} from "@/lib/geofence";

/**
 * GET /api/check-serviceability
 *   No coords → returns every configured store + polygon (drop into a map).
 *   With ?lat=..&lng=..&debug=1 → runs the serviceability check (mirrors POST).
 *   Public — no auth needed.
 *
 * The GET-with-query form exists because mobile clients (and cURL) sometimes
 * find it easier than crafting a JSON body. Both routes return the same shape.
 */
export const GET = handler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const latStr = searchParams.get("lat");
  const lngStr = searchParams.get("lng");
  const debug = searchParams.get("debug") === "1";

  // Serviceability check path (lat + lng provided)
  if (latStr != null && lngStr != null) {
    const lat = Number(latStr);
    const lng = Number(lngStr);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return fail("Invalid lat/lng query params", 400);
    }
    return runCheck(lat, lng, debug);
  }

  // Metadata path
  const stores = getStores();
  return ok({
    stores: stores.map((s) => ({
      id: s.id,
      name: s.name,
      center: { lat: s.lat, lng: s.lng },
      radius_km: s.radiusKm,
      eta_minutes: s.etaMinutes,
    })),
    geojson: {
      type: "FeatureCollection" as const,
      features: stores.map(storeGeoJSON),
    },
  });
});

/**
 * POST /api/check-serviceability
 * Body: { lat: number, lng: number, debug?: boolean }
 *
 * 200 → serviceable, includes store_id, distance, ETA, and center.
 * 403 → out-of-zone. Client should show the manual-address fallback.
 */
const bodySchema = z.object({
  lat: z.number(),
  lng: z.number(),
  debug: z.boolean().optional(),
});

export const POST = handler(async (req: NextRequest) => {
  const body = await parseJson(req, bodySchema);
  if (body instanceof NextResponse) return body;
  return runCheck(body.lat, body.lng, !!body.debug);
});

// ─── Shared check logic used by GET-with-query and POST ────────
function runCheck(lat: number, lng: number, debug: boolean) {
  const result = checkServiceability(lat, lng);

  // Debug echo — what did the server actually receive & compare against?
  // Handy when a client thinks "I'm at the store" but the server disagrees.
  const debugPayload = debug
    ? {
        received: { lat, lng },
        configured_stores: getStores(),
        result,
      }
    : undefined;

  // Always log server-side so `npm run dev` output shows what happened.
  // (Truncated to one line for grep-ability.)
  console.log(
    `[serviceability] received=(${lat}, ${lng}) → store=${result.store_id} distance=${result.distance_km}km radius=${result.radius_km}km → ${result.serviceable ? "OK" : "OUT_OF_ZONE"}`
  );

  if (!result.serviceable) {
    // Alias distance_km → distanceKm for camelCase clients (some UIs read that).
    return fail(
      "Sorry — you're outside our delivery zone.",
      403,
      { ...result, distanceKm: result.distance_km, ...(debug ? { debug: debugPayload } : {}) }
    );
  }

  // Same alias on success. Both keys work; new code should use snake_case.
  return ok({
    ...result,
    distanceKm: result.distance_km,
    ...(debug ? { debug: debugPayload } : {}),
  });
}

// CORS preflight for mobile clients
export const OPTIONS = handleOptions;
