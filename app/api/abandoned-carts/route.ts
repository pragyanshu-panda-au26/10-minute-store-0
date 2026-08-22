import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  fail,
  getAuth,
  handleOptions,
  handler,
  ok,
  parseJson,
  requireAuth,
} from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { toPaise, toRupees } from "@/lib/money";
import { enforceRateLimit } from "@/lib/rateLimit";

/**
 * Abandoned-cart persistence.
 *
 * The customer client posts a snapshot of the current cart whenever the shopper
 * lingers long enough on the cart drawer, delivery-address step, or payment
 * gateway without completing the order. The owner sees these in the admin
 * console and can (optionally) fire a "come back and finish?" nudge.
 *
 * Design notes:
 *   • One row per `(customerId, phone)` pair — new snapshots UPSERT so a
 *     shopper who slowly fills a bigger cart doesn't create ten rows.
 *   • The client sends line-item rupees (matches the storefront UX); we
 *     convert to paise here so the DB stays paise-only, matching Order.
 *   • Anonymous carts (no customer login yet) are allowed but rate-limited
 *     by IP so a scraper can't fill the table.
 *   • On order create the row auto-clears — see the delete-hook in the order
 *     route below where relevant.
 */

const itemSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().nullable().optional(),
  name: z.string().max(200),
  weight: z.string().max(80).optional().nullable(),
  imageUrl: z.string().max(1024).optional().nullable(),
  priceRupees: z.number().nonnegative(),
  quantity: z.number().int().positive().max(50),
});

const bodySchema = z.object({
  items: z.array(itemSchema).min(1).max(50),
  lastActiveStep: z.enum([
    "Basket Drawer",
    "Delivery Address Selection",
    "Payment Gateway",
  ]),
  phone: z.string().max(20).optional().nullable(),
  email: z.string().email().max(120).optional().nullable(),
  name: z.string().max(120).optional().nullable(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
});

/**
 * POST /api/abandoned-carts
 *   Public — customers may be anonymous (rate-limited) or logged in.
 *   Upserts a snapshot keyed by (customerId ?? phone ?? IP-derived stub).
 */
export const POST = handler(async (req: NextRequest) => {
  // 6 writes / minute is plenty for a real shopper (they'd have to change
  // the cart every 10s to hit it) and cheap for a scraper.
  const denied = enforceRateLimit(req, {
    bucket: "abandoned-carts",
    perMinute: 6,
    perHour: 60,
  });
  if (denied) return denied;

  const body = await parseJson(req, bodySchema);
  if (body instanceof NextResponse) return body;

  const auth = await getAuth(req);
  const customerId = auth?.role === "customer" ? auth.userId : null;

  // Compute totals in paise.
  const totalItems = body.items.reduce((n, i) => n + i.quantity, 0);
  const totalPaise = body.items.reduce(
    (sum, i) => sum + Math.round(toPaise(i.priceRupees) * i.quantity),
    0
  );

  // Identity for upsert. Prefer customerId (logged-in); fall back to phone.
  // A cart with neither is still stored but doesn't dedupe across sessions —
  // acceptable, since analytics cares about total-value not identity.
  let existing = null as null | { id: string };
  if (customerId) {
    existing = await prisma.abandonedCart
      .findFirst({
        where: { customerId },
        orderBy: { updatedAt: "desc" },
      })
      .catch(() => null);
  } else if (body.phone) {
    existing = await prisma.abandonedCart
      .findFirst({
        where: { phoneSnap: body.phone, customerId: null },
        orderBy: { updatedAt: "desc" },
      })
      .catch(() => null);
  }

  const data = {
    customerId,
    phoneSnap: body.phone ?? auth?.phone ?? null,
    emailSnap: body.email ?? null,
    nameSnap: body.name ?? auth?.name ?? null,
    // Store the client's snapshot verbatim — the admin view renders it
    // and needs the display fields the API contract already agreed on.
    itemsJson: body.items as any,
    totalValue: totalPaise,
    totalItems,
    lastActiveStep: body.lastActiveStep,
    lat: body.lat ?? null,
    lng: body.lng ?? null,
    // Fresh snapshot ⇒ recovery nudge is due again.
    recoveryPingSent: false,
  };

  let saved;
  try {
    saved = existing
      ? await prisma.abandonedCart.update({ where: { id: existing.id }, data })
      : await prisma.abandonedCart.create({ data });
  } catch (err) {
    console.error("[abandoned-carts] persist failed:", err);
    return fail("Could not persist cart snapshot.", 503);
  }

  return ok({
    cart: {
      id: saved.id,
      totalRupees: toRupees(saved.totalValue),
      totalItems: saved.totalItems,
      lastActiveStep: saved.lastActiveStep,
      updatedAt: saved.updatedAt.toISOString(),
    },
  });
});

/**
 * GET /api/abandoned-carts
 *   Admin-only. Returns the last 100 rows ordered newest-first. Filters:
 *     ?step=Basket Drawer | Delivery Address Selection | Payment Gateway
 *     ?since=<ISO date>
 *     ?limit=1..200 (default 50)
 */
export const GET = handler(async (req: NextRequest) => {
  const auth = await requireAuth(req, "admin");
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const step = searchParams.get("step");
  const sinceStr = searchParams.get("since");
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10) || 50));

  const since = sinceStr ? new Date(sinceStr) : null;

  const rows = await prisma.abandonedCart
    .findMany({
      where: {
        ...(step ? { lastActiveStep: step } : {}),
        ...(since && Number.isFinite(since.getTime()) ? { updatedAt: { gte: since } } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    })
    .catch(() => [] as any[]);

  return ok({
    carts: rows.map((r) => ({
      id: r.id,
      customerId: r.customerId,
      customerName: r.nameSnap,
      customerPhone: r.phoneSnap,
      customerEmail: r.emailSnap,
      items: r.itemsJson,
      totalRupees: toRupees(r.totalValue),
      totalItems: r.totalItems,
      lastActiveStep: r.lastActiveStep,
      recoveryPingSent: r.recoveryPingSent,
      lat: r.lat,
      lng: r.lng,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
  });
});

export const OPTIONS = handleOptions;
