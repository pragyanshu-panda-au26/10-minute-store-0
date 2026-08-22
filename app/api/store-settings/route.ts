import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  fail,
  handleOptions,
  handler,
  ok,
  parseJson,
  requireAuth,
} from "@/lib/api";
import {
  computeOpenState,
  getStoreSettings,
  updateStoreSettings,
} from "@/lib/storeSettings";

/**
 * GET /api/store-settings
 *   Public — used by the storefront to show "closed" banner + open hours.
 */
export const GET = handler(async () => {
  const settings = await getStoreSettings();
  const openState = computeOpenState(settings);
  return ok({ ...settings, ...openState });
});

const patchSchema = z.object({
  isOpen: z.boolean().optional(),
  closedMessage: z.string().max(200).nullable().optional(),
  etaMinutesOverride: z.number().int().min(0).max(240).nullable().optional(),
  weeklyHours: z
    .record(
      z.enum(["0", "1", "2", "3", "4", "5", "6"]),
      z.object({
        open: z.string().regex(/^\d{2}:\d{2}$/),
        close: z.string().regex(/^\d{2}:\d{2}$/),
        closed: z.boolean().optional(),
      })
    )
    .optional(),
  // Live-editable geofence
  storeLat: z.number().min(-90).max(90).nullable().optional(),
  storeLng: z.number().min(-180).max(180).nullable().optional(),
  deliveryRadiusKm: z.number().min(0.1).max(50).nullable().optional(),
  // Drawn polygon — array of [lng, lat] pairs. Null = drop back to radius.
  deliveryPolygon: z
    .array(z.tuple([z.number(), z.number()]))
    .min(3)
    .max(200)
    .nullable()
    .optional(),
  // Fee config — paise. Caps prevent typo blowups (₹1000 delivery fee).
  deliveryFeeDefault: z.number().int().min(0).max(100000).optional(),
  freeAboveThreshold: z.number().int().min(0).max(10000000).optional(),
  handlingFeeDefault: z.number().int().min(0).max(100000).optional(),
  // Slot config
  slotEnabled: z.boolean().optional(),
  slotDurationMinutes: z.number().int().min(15).max(240).optional(),
  slotCapacity: z.number().int().min(1).max(1000).optional(),
  slotLeadMinutes: z.number().int().min(0).max(720).optional(),
});

/**
 * PUT /api/store-settings
 *   Admin-only. Any subset of fields — the rest untouched.
 */
export const PUT = handler(async (req: NextRequest) => {
  const auth = await requireAuth(req, "admin");
  if (auth instanceof NextResponse) return auth;
  const body = await parseJson(req, patchSchema);
  if (body instanceof NextResponse) return body;

  const updated = await updateStoreSettings(body as any);
  const openState = computeOpenState(updated);
  return ok({ ...updated, ...openState });
});

export const OPTIONS = handleOptions;
