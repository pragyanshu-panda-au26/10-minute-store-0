/**
 * Slot-based delivery helpers.
 *
 * A "slot" is a fixed-duration window ([start, end)) that a customer can
 * reserve at checkout instead of asking for instant delivery. Slots are
 * generated dynamically from the store's business hours + slot config —
 * we do NOT pre-materialise them in a table, because that would be a
 * ton of rows for no benefit. Capacity is enforced by counting existing
 * Orders whose `scheduledFor` falls inside the window.
 */
import { prisma } from "@/lib/prisma";
import type { StoreSettingsShape, WeeklyHours } from "@/lib/storeSettings";

export interface DeliverySlot {
  /** ISO string of slot start */
  start: string;
  /** ISO string of slot end (exclusive) */
  end: string;
  /** e.g. "5:00 PM – 6:00 PM" */
  label: string;
  /** Number of orders already booked in this slot */
  booked: number;
  /** Remaining orders that can still be booked */
  remaining: number;
  /** true when slot is in the past OR at capacity */
  soldOut: boolean;
}

const fmtTime = (d: Date) =>
  d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });

const fmtLabel = (start: Date, end: Date) => `${fmtTime(start)} – ${fmtTime(end)}`;

const dayOfWeekKey = (d: Date): keyof WeeklyHours =>
  String(d.getDay()) as keyof WeeklyHours;

/**
 * Build the raw slot windows for a single calendar day, based on that day's
 * business hours. Ignores capacity / booking counts — call `annotateSlots`
 * for the "how many left" values.
 */
export function buildSlotsForDay(
  day: Date,
  settings: Pick<StoreSettingsShape, "weeklyHours" | "slotDurationMinutes">
): { start: Date; end: Date; label: string }[] {
  const hours = settings.weeklyHours[dayOfWeekKey(day)];
  if (!hours || hours.closed) return [];

  const [oh, om] = hours.open.split(":").map(Number);
  const [ch, cm] = hours.close.split(":").map(Number);
  const step = Math.max(15, settings.slotDurationMinutes ?? 60);

  const slots: { start: Date; end: Date; label: string }[] = [];
  const base = new Date(day);
  base.setHours(oh, om, 0, 0);
  const closeAt = new Date(day);
  closeAt.setHours(ch, cm, 0, 0);

  for (
    let cursor = new Date(base);
    cursor.getTime() + step * 60_000 <= closeAt.getTime();
    cursor = new Date(cursor.getTime() + step * 60_000)
  ) {
    const end = new Date(cursor.getTime() + step * 60_000);
    slots.push({ start: new Date(cursor), end, label: fmtLabel(cursor, end) });
  }
  return slots;
}

/**
 * For a window (usually the next 24–48 h), return every slot with its
 * remaining capacity. Slots earlier than `now + leadMinutes` are marked
 * `soldOut: true` so the UI shows them as unavailable.
 */
export async function listUpcomingSlots(
  settings: StoreSettingsShape,
  hoursAhead = 48,
  now: Date = new Date()
): Promise<DeliverySlot[]> {
  if (!settings.slotEnabled) return [];

  const horizon = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
  const raw: { start: Date; end: Date; label: string }[] = [];
  for (
    let day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    day <= horizon;
    day = new Date(day.getTime() + 24 * 60 * 60 * 1000)
  ) {
    raw.push(...buildSlotsForDay(day, settings));
  }

  const inWindow = raw.filter((s) => s.start >= now && s.start <= horizon);
  if (inWindow.length === 0) return [];

  // Single query — count booked orders across the whole window
  const booked = await prisma.order.groupBy({
    by: ["scheduledFor"],
    where: {
      scheduledFor: {
        gte: inWindow[0].start,
        lte: inWindow[inWindow.length - 1].end,
      },
      status: { notIn: ["cancelled"] },
    },
    _count: { _all: true },
  });
  const bookedMap = new Map<number, number>();
  for (const b of booked) {
    if (!b.scheduledFor) continue;
    bookedMap.set(b.scheduledFor.getTime(), b._count._all);
  }

  const leadCutoff = new Date(now.getTime() + settings.slotLeadMinutes * 60_000);
  return inWindow.map<DeliverySlot>((s) => {
    const bookedCount = bookedMap.get(s.start.getTime()) ?? 0;
    const remaining = Math.max(0, settings.slotCapacity - bookedCount);
    const tooSoon = s.start < leadCutoff;
    return {
      start: s.start.toISOString(),
      end: s.end.toISOString(),
      label: s.label,
      booked: bookedCount,
      remaining,
      soldOut: tooSoon || remaining <= 0,
    };
  });
}

/**
 * Server-side validation for an incoming order's `scheduledFor`. Returns
 * a rejection reason or null if the slot is currently bookable.
 */
export async function validateSlotBooking(
  scheduledFor: Date,
  settings: StoreSettingsShape,
  now: Date = new Date()
): Promise<string | null> {
  if (!settings.slotEnabled) {
    return "Slot-based delivery is disabled for this store.";
  }
  const step = settings.slotDurationMinutes;
  // Slot start must align with a real slot boundary for that day
  const daySlots = buildSlotsForDay(
    new Date(scheduledFor.getFullYear(), scheduledFor.getMonth(), scheduledFor.getDate()),
    settings
  );
  const match = daySlots.find(
    (s) => Math.abs(s.start.getTime() - scheduledFor.getTime()) < 60_000
  );
  if (!match) return "Selected slot is not a valid delivery window.";

  // Lead time
  if (scheduledFor.getTime() < now.getTime() + settings.slotLeadMinutes * 60_000) {
    return `Slots must be at least ${settings.slotLeadMinutes} minutes from now.`;
  }

  // Capacity
  const booked = await prisma.order.count({
    where: { scheduledFor, status: { notIn: ["cancelled"] } },
  });
  if (booked >= settings.slotCapacity) return "Selected slot is fully booked.";

  return null;
}
