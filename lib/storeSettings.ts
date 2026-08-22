/**
 * Store-open helpers used by BOTH the API routes (server-side gating) AND
 * the admin/customer UI (via GET /api/store-settings).
 *
 * `weeklyHours` shape:
 *   { "0": { open: "09:00", close: "22:00", closed: false }, ... "6": ... }
 * where keys are 0=Sun, 1=Mon, ... 6=Sat.
 */
import { prisma } from "@/lib/prisma";

export interface DayHours {
  open: string; // "HH:MM"
  close: string; // "HH:MM"
  closed?: boolean;
}
export type WeeklyHours = Partial<Record<"0" | "1" | "2" | "3" | "4" | "5" | "6", DayHours>>;

export interface StoreSettingsShape {
  isOpen: boolean;
  closedMessage: string | null;
  weeklyHours: WeeklyHours;
  etaMinutesOverride: number | null;
  // Live-editable geofence — null means "use env defaults from lib/geofence.ts"
  storeLat: number | null;
  storeLng: number | null;
  deliveryRadiusKm: number | null;
  // Drawn polygon overrides the radius when present. GeoJSON-style ring:
  //   [[lng, lat], [lng, lat], ..., [lng, lat]]  (last vertex should equal first)
  deliveryPolygon: [number, number][] | null;
  // Live-editable pricing — all paise. Server-side order pricing reads these
  // on every checkout, so owner changes here take effect immediately.
  deliveryFeeDefault: number;
  freeAboveThreshold: number;
  handlingFeeDefault: number;
  // Slot-based delivery
  slotEnabled: boolean;
  slotDurationMinutes: number;
  slotCapacity: number;
  slotLeadMinutes: number;
}

const SINGLETON_ID = "singleton";

const DEFAULT_HOURS: WeeklyHours = {
  "0": { open: "09:00", close: "22:00" },
  "1": { open: "09:00", close: "22:00" },
  "2": { open: "09:00", close: "22:00" },
  "3": { open: "09:00", close: "22:00" },
  "4": { open: "09:00", close: "22:00" },
  "5": { open: "09:00", close: "22:00" },
  "6": { open: "09:00", close: "22:00" },
};

/** Read the singleton, auto-creating with defaults on first call. */
export async function getStoreSettings(): Promise<StoreSettingsShape> {
  const row = await prisma.storeSetting.upsert({
    where: { id: SINGLETON_ID },
    update: {},
    create: {
      id: SINGLETON_ID,
      isOpen: true,
      weeklyHours: DEFAULT_HOURS as any,
    },
  });
  return {
    isOpen: row.isOpen,
    closedMessage: row.closedMessage,
    weeklyHours: (row.weeklyHours as WeeklyHours) ?? DEFAULT_HOURS,
    etaMinutesOverride: row.etaMinutesOverride,
    storeLat: row.storeLat,
    storeLng: row.storeLng,
    deliveryRadiusKm: row.deliveryRadiusKm,
    deliveryPolygon: (row.deliveryPolygon as [number, number][] | null) ?? null,
    deliveryFeeDefault: row.deliveryFeeDefault,
    freeAboveThreshold: row.freeAboveThreshold,
    handlingFeeDefault: row.handlingFeeDefault,
    slotEnabled: row.slotEnabled,
    slotDurationMinutes: row.slotDurationMinutes,
    slotCapacity: row.slotCapacity,
    slotLeadMinutes: row.slotLeadMinutes,
  };
}

export async function updateStoreSettings(
  patch: Partial<StoreSettingsShape>
): Promise<StoreSettingsShape> {
  await getStoreSettings(); // ensure row exists
  const row = await prisma.storeSetting.update({
    where: { id: SINGLETON_ID },
    data: {
      ...(patch.isOpen !== undefined ? { isOpen: patch.isOpen } : {}),
      ...(patch.closedMessage !== undefined ? { closedMessage: patch.closedMessage } : {}),
      ...(patch.weeklyHours !== undefined ? { weeklyHours: patch.weeklyHours as any } : {}),
      ...(patch.etaMinutesOverride !== undefined
        ? { etaMinutesOverride: patch.etaMinutesOverride }
        : {}),
      ...(patch.storeLat !== undefined ? { storeLat: patch.storeLat } : {}),
      ...(patch.storeLng !== undefined ? { storeLng: patch.storeLng } : {}),
      ...(patch.deliveryRadiusKm !== undefined
        ? { deliveryRadiusKm: patch.deliveryRadiusKm }
        : {}),
      ...(patch.deliveryPolygon !== undefined
        ? { deliveryPolygon: patch.deliveryPolygon as any }
        : {}),
      ...(patch.deliveryFeeDefault !== undefined
        ? { deliveryFeeDefault: patch.deliveryFeeDefault }
        : {}),
      ...(patch.freeAboveThreshold !== undefined
        ? { freeAboveThreshold: patch.freeAboveThreshold }
        : {}),
      ...(patch.handlingFeeDefault !== undefined
        ? { handlingFeeDefault: patch.handlingFeeDefault }
        : {}),
      ...(patch.slotEnabled !== undefined ? { slotEnabled: patch.slotEnabled } : {}),
      ...(patch.slotDurationMinutes !== undefined
        ? { slotDurationMinutes: patch.slotDurationMinutes }
        : {}),
      ...(patch.slotCapacity !== undefined ? { slotCapacity: patch.slotCapacity } : {}),
      ...(patch.slotLeadMinutes !== undefined
        ? { slotLeadMinutes: patch.slotLeadMinutes }
        : {}),
    },
  });
  return {
    isOpen: row.isOpen,
    closedMessage: row.closedMessage,
    weeklyHours: (row.weeklyHours as WeeklyHours) ?? DEFAULT_HOURS,
    etaMinutesOverride: row.etaMinutesOverride,
    storeLat: row.storeLat,
    storeLng: row.storeLng,
    deliveryRadiusKm: row.deliveryRadiusKm,
    deliveryPolygon: (row.deliveryPolygon as [number, number][] | null) ?? null,
    deliveryFeeDefault: row.deliveryFeeDefault,
    freeAboveThreshold: row.freeAboveThreshold,
    handlingFeeDefault: row.handlingFeeDefault,
    slotEnabled: row.slotEnabled,
    slotDurationMinutes: row.slotDurationMinutes,
    slotCapacity: row.slotCapacity,
    slotLeadMinutes: row.slotLeadMinutes,
  };
}

/**
 * Compute whether the store is currently taking orders. Returns a reason
 * string so callers can show useful feedback ("closed for Diwali", "opens at 9am").
 *
 * Called from BOTH the serviceability check and the order-create route.
 */
export function computeOpenState(
  settings: StoreSettingsShape,
  now: Date = new Date()
): { open: boolean; reason?: string; opensAt?: string; closesAt?: string } {
  // Manual master switch wins
  if (!settings.isOpen) {
    return {
      open: false,
      reason: settings.closedMessage || "Store is temporarily closed. Please try again shortly.",
    };
  }

  const day = String(now.getDay()) as keyof WeeklyHours;
  const today = settings.weeklyHours[day];
  if (!today) return { open: true }; // no schedule set → always open
  if (today.closed) {
    return { open: false, reason: "Store is closed today. See you tomorrow." };
  }

  const [openH, openM] = today.open.split(":").map(Number);
  const [closeH, closeM] = today.close.split(":").map(Number);
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const openMins = openH * 60 + openM;
  const closeMins = closeH * 60 + closeM;

  if (nowMins < openMins) {
    return { open: false, reason: `Store opens at ${today.open}.`, opensAt: today.open };
  }
  if (nowMins >= closeMins) {
    return { open: false, reason: `Store closed at ${today.close}. Back tomorrow.`, closesAt: today.close };
  }
  return { open: true, closesAt: today.close };
}
