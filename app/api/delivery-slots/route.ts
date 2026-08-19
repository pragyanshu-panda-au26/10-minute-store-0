import { NextRequest } from "next/server";
import { fail, handleOptions, handler, ok } from "@/lib/api";
import { getStoreSettings } from "@/lib/storeSettings";
import { listUpcomingSlots } from "@/lib/deliverySlots";

/**
 * GET /api/delivery-slots?hours=48
 * Public — customer picks a slot at checkout.
 *
 * Response:
 *   {
 *     enabled: boolean,
 *     slotDurationMinutes: number,
 *     slots: [
 *       { start, end, label, remaining, booked, soldOut }, ...
 *     ]
 *   }
 */
export const GET = handler(async (req: NextRequest) => {
  const settings = await getStoreSettings();
  if (!settings.slotEnabled) {
    return ok({
      enabled: false,
      slotDurationMinutes: settings.slotDurationMinutes,
      slots: [],
    });
  }

  const { searchParams } = new URL(req.url);
  const hoursRaw = Number(searchParams.get("hours") ?? 48);
  const hours = Number.isFinite(hoursRaw) ? Math.min(Math.max(hoursRaw, 1), 168) : 48;

  const slots = await listUpcomingSlots(settings, hours);
  return ok({
    enabled: true,
    slotDurationMinutes: settings.slotDurationMinutes,
    slotLeadMinutes: settings.slotLeadMinutes,
    slotCapacity: settings.slotCapacity,
    slots,
  });
});

export const OPTIONS = handleOptions;
