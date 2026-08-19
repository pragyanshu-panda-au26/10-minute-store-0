import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fail, handleOptions, handler, ok, parseJson } from "@/lib/api";
import { checkServiceability, getStores, storeGeoJSON } from "@/lib/geofence";
import { computeOpenState, getStoreSettings } from "@/lib/storeSettings";

/**
 * GET /api/check-serviceability
 *   No coords → returns store list + polygon + current open/close state.
 *   With ?lat=..&lng=.. → runs the serviceability check.
 *   Public — no auth needed.
 */
export const GET = handler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const latStr = searchParams.get("lat");
  const lngStr = searchParams.get("lng");
  const debug = searchParams.get("debug") === "1";

  const settings = await getStoreSettings().catch(() => null);
  const openState = settings ? computeOpenState(settings) : { open: true };

  if (latStr != null && lngStr != null) {
    const lat = Number(latStr);
    const lng = Number(lngStr);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return fail("Invalid lat/lng query params", 400);
    }
    return runCheck(lat, lng, debug, settings, openState);
  }

  // Metadata path — merge DB overrides so the map shows the live radius.
  const stores = getStores();
  const primary = stores[0];
  const patched = settings
    ? [
        {
          ...primary,
          lat: settings.storeLat ?? primary.lat,
          lng: settings.storeLng ?? primary.lng,
          radiusKm: settings.deliveryRadiusKm ?? primary.radiusKm,
          etaMinutes: settings.etaMinutesOverride ?? primary.etaMinutes,
        },
        ...stores.slice(1),
      ]
    : stores;

  return ok({
    stores: patched.map((s) => ({
      id: s.id,
      name: s.name,
      center: { lat: s.lat, lng: s.lng },
      radius_km: s.radiusKm,
      eta_minutes: s.etaMinutes,
    })),
    geojson: {
      type: "FeatureCollection" as const,
      features: patched.map(storeGeoJSON),
    },
    open: openState.open,
    closed_reason: (openState as any).reason ?? null,
    opens_at: (openState as any).opensAt ?? null,
    closes_at: (openState as any).closesAt ?? null,
  });
});

const bodySchema = z.object({
  lat: z.number(),
  lng: z.number(),
  debug: z.boolean().optional(),
});

export const POST = handler(async (req: NextRequest) => {
  const body = await parseJson(req, bodySchema);
  if (body instanceof NextResponse) return body;
  const settings = await getStoreSettings().catch(() => null);
  const openState = settings ? computeOpenState(settings) : { open: true };
  return runCheck(body.lat, body.lng, !!body.debug, settings, openState);
});

// ─── Shared check logic ────────────────────────────────────
function runCheck(
  lat: number,
  lng: number,
  debug: boolean,
  settings: Awaited<ReturnType<typeof getStoreSettings>> | null,
  openState: { open: boolean; reason?: string }
) {
  const result = checkServiceability(lat, lng, settings ?? undefined);

  console.log(
    `[serviceability] (${lat}, ${lng}) → ${result.store_id} distance=${result.distance_km}km radius=${result.radius_km}km → ${result.serviceable ? "OK" : "OUT_OF_ZONE"} · store_open=${openState.open}`
  );

  const debugPayload = debug
    ? { received: { lat, lng }, settings, openState, result }
    : undefined;

  // Store closed → serviceable=false with a store_closed reason (503-ish).
  // We still return 200 so the client can distinguish this cleanly via
  // `data.reason === "store_closed"` (rather than a network-looking 500).
  if (!openState.open) {
    return ok({
      ...result,
      serviceable: false,
      reason: "store_closed" as const,
      message: openState.reason || "The store is currently closed.",
      distanceKm: result.distance_km,
      ...(debug ? { debug: debugPayload } : {}),
    });
  }

  if (!result.serviceable) {
    return fail("Sorry — you're outside our delivery zone.", 403, {
      ...result,
      distanceKm: result.distance_km,
      ...(debug ? { debug: debugPayload } : {}),
    });
  }

  return ok({
    ...result,
    distanceKm: result.distance_km,
    ...(debug ? { debug: debugPayload } : {}),
  });
}

export const OPTIONS = handleOptions;
