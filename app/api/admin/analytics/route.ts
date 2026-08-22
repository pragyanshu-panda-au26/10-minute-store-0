import { NextRequest, NextResponse } from "next/server";
import { handler, ok, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { toRupees } from "@/lib/money";

/**
 * GET /api/admin/analytics
 *   Admin-only. Rolls up the last N days into the numbers an owner actually
 *   watches: revenue (excluding cancelled/refunded), order counts by status,
 *   AOV, per-hour trend for today, top-selling products, low-stock alert
 *   count. Everything is a single query per metric so the whole roll-up
 *   returns in one round-trip.
 *
 *   Query params:
 *     days=7   (default 7, max 90)
 *
 * Deliberately simple SQL-free Prisma — no aggregates on paise columns that
 * would risk overflow at scale. If order volume grows past ~10k/day, swap
 * these for `prisma.$queryRaw` on a materialized view.
 */

const HOUR_MS = 60 * 60 * 1000;

export const GET = handler(async (req: NextRequest) => {
  const auth = await requireAuth(req, "admin");
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const days = Math.min(90, Math.max(1, parseInt(searchParams.get("days") ?? "7", 10) || 7));
  const now = new Date();
  const since = new Date(now.getTime() - days * 24 * HOUR_MS);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // ── Orders in window ───────────────────────────────────────
  // Include items so we can compute top sellers in the same pass.
  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: since } },
    include: {
      items: { select: { productId: true, nameSnap: true, quantity: true, unitPrice: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const paidOrders = orders.filter((o) => o.paymentStatus === "paid" && o.status !== "cancelled");
  const cancelledCount = orders.filter((o) => o.status === "cancelled").length;
  const pendingCount = orders.filter((o) => o.status === "pending").length;
  const deliveredCount = orders.filter((o) => o.status === "delivered").length;

  const grossPaise = paidOrders.reduce((sum, o) => sum + (o.total ?? 0), 0);
  const refundedPaise = paidOrders.reduce((sum, o) => sum + (o.refundAmount ?? 0), 0);
  const netPaise = grossPaise - refundedPaise;
  const aovPaise = paidOrders.length > 0 ? Math.round(netPaise / paidOrders.length) : 0;

  // ── Per-hour trend for TODAY only ──────────────────────────
  // 24 buckets, keyed by local hour. UI plots this as a sparkline / bar.
  const perHourToday: { hour: number; orders: number; revenue: number }[] = Array.from(
    { length: 24 },
    (_, hour) => ({ hour, orders: 0, revenue: 0 })
  );
  for (const o of orders) {
    if (o.createdAt < startOfToday) continue;
    const h = new Date(o.createdAt).getHours();
    const bucket = perHourToday[h];
    bucket.orders += 1;
    if (o.paymentStatus === "paid" && o.status !== "cancelled") {
      bucket.revenue += toRupees(o.total ?? 0);
    }
  }

  // ── Per-day trend across the window ────────────────────────
  const dayBuckets = new Map<string, { orders: number; revenue: number }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(startOfToday.getTime() - i * 24 * HOUR_MS);
    const key = d.toISOString().slice(0, 10);
    dayBuckets.set(key, { orders: 0, revenue: 0 });
  }
  for (const o of orders) {
    const key = o.createdAt.toISOString().slice(0, 10);
    const bucket = dayBuckets.get(key);
    if (!bucket) continue;
    bucket.orders += 1;
    if (o.paymentStatus === "paid" && o.status !== "cancelled") {
      bucket.revenue += toRupees(o.total ?? 0);
    }
  }
  const perDay = Array.from(dayBuckets.entries())
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // ── Top sellers by quantity in the window ──────────────────
  const productTally = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const o of orders) {
    if (o.status === "cancelled") continue;
    for (const item of o.items) {
      const entry = productTally.get(item.productId) ?? {
        name: item.nameSnap,
        quantity: 0,
        revenue: 0,
      };
      entry.quantity += item.quantity;
      entry.revenue += toRupees(item.unitPrice * item.quantity);
      productTally.set(item.productId, entry);
    }
  }
  const topProducts = Array.from(productTally.entries())
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  // ── Live counters (not window-limited) ─────────────────────
  const [customersCount, lowStockCount, openTickets] = await Promise.all([
    prisma.customer.count().catch(() => 0),
    prisma.product.count({ where: { isActive: true, stock: { lte: 5 } } }).catch(() => 0),
    // Support tickets still live in the file DB — the /api/support GET route
    // is where the count comes from once we migrate. Return 0 here so the
    // dashboard doesn't guess; the dedicated support inbox page has the
    // authoritative number.
    Promise.resolve(0),
  ]);

  // Cart-abandon proxy: pending orders older than 30 min that never confirmed.
  const abandonCutoff = new Date(now.getTime() - 30 * 60 * 1000);
  const abandonedOrderish = orders.filter(
    (o) => o.status === "pending" && o.paymentStatus !== "paid" && o.createdAt < abandonCutoff
  ).length;

  return ok({
    window: { days, since: since.toISOString(), until: now.toISOString() },
    revenue: {
      grossRupees: toRupees(grossPaise),
      refundedRupees: toRupees(refundedPaise),
      netRupees: toRupees(netPaise),
      aovRupees: toRupees(aovPaise),
    },
    counts: {
      orders: orders.length,
      paid: paidOrders.length,
      pending: pendingCount,
      cancelled: cancelledCount,
      delivered: deliveredCount,
      abandoned: abandonedOrderish,
      customers: customersCount,
      lowStock: lowStockCount,
      openTickets,
    },
    perHourToday,
    perDay,
    topProducts,
  });
});
