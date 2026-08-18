import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fail, handleOptions, handler, ok, parseJson, requireAuth } from "@/lib/api";
import { getStores, checkServiceability, StoreConfig } from "@/lib/geofence";

/**
 * Admin geofence management.
 *
 * GET  /api/admin/geofence          → current store config
 * POST /api/admin/geofence          → replace store config (admin JWT required)
 * POST /api/admin/geofence/test     → NOT here; use the top-level
 *                                     /api/check-serviceability for testing.
 *
 * IMPORTANT: this mutates `process.env.STORES_JSON` on the running
 * instance only. In serverless (Vercel), each function invocation may hit
 * a different cold instance, so persistent changes must be made in the
 * Vercel dashboard as an environment variable and redeployed. For a
 * single-instance / long-running host it works as a live-edit knob.
 *
 * The right long-term home for this is a Prisma `Store` table; when you
 * add it, swap out `readStores` / `writeStores` for DB queries and the
 * client contract stays identical.
 */

const storeSchema = z.object({
  id: z.string().min(1).max(60),
  name: z.string().min(1).max(120),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusKm: z.number().positive().max(50),
  etaMinutes: z.number().int().positive().max(240),
});

const putSchema = z.object({
  stores: z.array(storeSchema).min(1).max(20),
});

export const GET = handler(async (req: NextRequest) => {
  const auth = await requireAuth(req, "admin");
  if (auth instanceof NextResponse) return auth;
  return ok({
    stores: getStores(),
    persisted_via: "env:STORES_JSON",
    hint:
      "To persist across serverless cold starts, copy the JSON below into the STORES_JSON env var in your hosting dashboard and redeploy.",
    stores_json_value: JSON.stringify(getStores()),
  });
});

export const POST = handler(async (req: NextRequest) => {
  const auth = await requireAuth(req, "admin");
  if (auth instanceof NextResponse) return auth;
  const body = await parseJson(req, putSchema);
  if (body instanceof NextResponse) return body;

  // Basic sanity: no two stores with the same id
  const ids = new Set(body.stores.map((s) => s.id));
  if (ids.size !== body.stores.length) return fail("Duplicate store ids", 400);

  process.env.STORES_JSON = JSON.stringify(body.stores as StoreConfig[]);

  return ok({
    message:
      "Geofence updated on this instance. Copy the STORES_JSON value into your hosting env vars to make it permanent.",
    stores: getStores(),
    stores_json_value: process.env.STORES_JSON,
  });
});

// Small helper: `POST /api/admin/geofence?test=1&lat=..&lng=..` returns
// what a customer at those coords would see — handy for the admin map UI.
export const OPTIONS = handleOptions;
