import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fail, generateOrderNumber, getAuth, handler, ok, parseJson, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { toPaise, toRupees } from "@/lib/money";
import { serializeOrder } from "@/lib/serializers";
import { computeOpenState, getStoreSettings } from "@/lib/storeSettings";
import { validateSlotBooking } from "@/lib/deliverySlots";
import { orderConfirmationEmail, sendEmail } from "@/lib/email";
import { sendOrderSms } from "@/lib/sms";
import { checkServiceability } from "@/lib/geofence";
import { Prisma } from "@prisma/client";

/**
 * GET /api/orders
 *   - admin: returns all orders
 *   - customer: returns only their own orders
 *   - unauthenticated: 401
 */
export const GET = handler(async (req: NextRequest) => {
  const auth = await getAuth(req);
  if (!auth) return fail("Authentication required", 401);

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as any;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 200);
  const q = searchParams.get("q")?.trim();
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");
  const from = fromStr ? new Date(fromStr) : null;
  const to = toStr ? new Date(toStr) : null;

  // Prisma is the ONE source of truth on the read path. The previous
  // implementation merged file-DB rows into the response as a "just in case"
  // resilience layer — that quietly produced two-brains state where different
  // requests saw different truths depending on which serverless instance
  // answered. If Prisma is genuinely down we now return 503 so the client can
  // retry with backoff, instead of masking the outage with stale data.
  let orders: any[];
  try {
    const prismaOrders = await prisma.order.findMany({
      where: {
        ...(auth.role === "customer" ? { customerId: auth.userId } : {}),
        ...(status ? { status } : {}),
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
        ...(q
          ? {
              OR: [
                { orderNumber: { contains: q, mode: "insensitive" } },
                { customerPhoneSnap: { contains: q } },
                { customerNameSnap: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    orders = prismaOrders.map(serializeOrder);
  } catch (err) {
    console.error("[/api/orders] Prisma orders query failed:", err);
    return fail("Orders service is temporarily unavailable. Please try again.", 503);
  }

  return ok({ orders });
});

const itemSchema = z.object({
  productId: z.string(),
  variantId: z.string().optional().nullable(),
  quantity: z.number().int().positive().max(50),
});

const createSchema = z.object({
  items: z.array(itemSchema).min(1),
  deliveryAddress: z.string().min(6).max(400),
  lat: z.number().optional(),
  lng: z.number().optional(),
  couponCode: z.string().max(40).optional().nullable(),
  paymentMethod: z.enum(["cod", "razorpay"]),
  customerName: z.string().max(80).optional(),
  customerPhone: z.string().max(20).optional(),
  notes: z.string().max(400).optional(), // delivery instructions
  // Blinkit-style extras
  tip: z.number().int().nonnegative().max(100000).optional(), // rupees
  handlingFee: z.number().int().nonnegative().max(10000).optional(), // rupees (usually server-set)
  // Slot booking (optional — omit for instant delivery)
  scheduledFor: z.string().datetime().optional().nullable(),
  // Idempotency key — a stable random id the storefront sends once per Place
  // Order tap. Repeated POSTs with the same key resolve to the same order row
  // instead of creating duplicates. Also accepted as an "Idempotency-Key" header.
  idempotencyKey: z.string().min(8).max(128).optional().nullable(),
});

export const POST = handler(async (req: NextRequest) => {
  const auth = await requireAuth(req, "customer");
  if (auth instanceof NextResponse) return auth;

  const body = await parseJson(req, createSchema);
  if (body instanceof NextResponse) return body;

  // Idempotency: header wins over body — headers survive body-parse retries.
  // If we've already seen this key from this customer, return the existing
  // order verbatim rather than creating another one. Missing key → allow the
  // create; the storefront should send one, but older clients still work.
  const idempotencyKey =
    req.headers.get("idempotency-key")?.trim() || body.idempotencyKey || null;
  if (idempotencyKey) {
    const existing = await prisma.order
      .findUnique({
        where: { idempotencyKey },
        include: { items: true },
      })
      .catch(() => null);
    if (existing) {
      if (existing.customerId !== auth.userId) {
        return fail("Idempotency key belongs to a different account.", 409);
      }
      return ok({ order: serializeOrder(existing) }, { status: 200 });
    }
  }

  // Load settings once — gates the store-open check, the slot check, the
  // pricing config, AND the serviceability re-check. Reading four times would
  // just cost round-trips for no upside.
  const settings = await getStoreSettings().catch((err) => {
    console.error("[orders] store settings read failed:", err);
    return null;
  });
  if (!settings) {
    return fail("Store configuration unavailable — please try again shortly.", 503);
  }
  const openState = computeOpenState(settings);

  // Store must be open to accept new orders. Admin toggles via /admin/settings.
  // Also: if a slot is requested, it must be valid + have capacity.
  let scheduledForDate: Date | null = null;
  if (body.scheduledFor) {
    scheduledForDate = new Date(body.scheduledFor);
    if (!Number.isFinite(scheduledForDate.getTime())) {
      return fail("Invalid scheduledFor timestamp", 400);
    }
    // Slot orders are for future fulfillment — allowed even while the store
    // is currently closed. Instant orders still require open.
    const rejection = await validateSlotBooking(scheduledForDate, settings);
    if (rejection) return fail(rejection, 409);
  } else if (!openState.open) {
    return fail(
      openState.reason || "Store is currently closed. Please try again shortly.",
      503
    );
  }

  // Serviceability re-check — client already gated on this at browse time,
  // but the radius may have shrunk between then and now, or the coordinates
  // could be spoofed. Enforce here as the authoritative decision. If the
  // client didn't send coords, we let the order through (address-only flow
  // is legitimate for landline / kiosk placements the owner takes on paper).
  if (typeof body.lat === "number" && typeof body.lng === "number") {
    const svc = checkServiceability(body.lat, body.lng, settings);
    if (!svc.serviceable) {
      return fail(
        svc.reason === "invalid_coords"
          ? "Delivery location is invalid. Please pick your address again."
          : "Sorry — that address is outside our current delivery zone.",
        403
      );
    }
  }

  // Never fall back to a hardcoded name/phone — a stray order should carry
  // whatever identity the authenticated session actually holds, otherwise
  // Order #123 gets stamped with someone else's personal details. If we can't
  // resolve a phone at all, refuse the order — placing one without a callback
  // number is broken by construction.
  const userPhone = body.customerPhone || auth.phone;
  if (!userPhone) {
    return fail("A verified phone number is required to place an order.", 400);
  }
  const userName = body.customerName || auth.name || "Customer";

  // Ensure Customer record exists in Prisma DB before order placement.
  // No file-DB fallback — if the DB can't upsert a customer, the order will
  // fail downstream anyway; better to fail fast with a clean 503.
  let customer;
  try {
    customer = await prisma.customer.upsert({
      where: { id: auth.userId },
      update: { name: userName, phone: userPhone },
      create: { id: auth.userId, phone: userPhone, name: userName },
    });
  } catch (err) {
    console.error("[orders] customer upsert failed:", err);
    return fail("Account service temporarily unavailable. Please try again.", 503);
  }

  if (customer.isBlocked) return fail("Account is blocked", 403);

  // Fetch products + variants referenced. Prisma is the only source of truth
  // — the file-DB fallback was dropped along with the fake-order fabricator.
  const productIds = body.items.map((i) => i.productId);
  const variantIds = body.items
    .map((i) => i.variantId)
    .filter((v): v is string => Boolean(v));
  let products: Array<{ id: string; name: string; price: number; weight: string; imageUrl: string; stock: number }>;
  let variants: Array<{ id: string; productId: string; label: string; price: number; imageUrl: string | null; stock: number }>;
  try {
    products = await prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
    });
    variants =
      variantIds.length > 0
        ? await prisma.productVariant.findMany({ where: { id: { in: variantIds } } })
        : [];
  } catch (err) {
    console.error("[orders] catalog fetch failed:", err);
    return fail("Catalog service temporarily unavailable. Please try again.", 503);
  }

  const productMap = new Map(products.map((p) => [p.id, p]));
  const variantMap = new Map(variants.map((v) => [v.id, v]));

  /** Resolve unit price (paise) for a line item — prefers variant, falls back to product. */
  const resolveUnitPricePaise = (
    item: { productId: string; variantId?: string | null }
  ): { paise: number; label: string; image?: string | null } | null => {
    if (item.variantId) {
      const v = variantMap.get(item.variantId);
      if (v && v.productId === item.productId) {
        return { paise: v.price, label: v.label, image: v.imageUrl };
      }
    }
    const p = productMap.get(item.productId);
    if (!p) return null;
    return { paise: p.price, label: p.weight, image: p.imageUrl };
  };

  // Validate + compute subtotal (paise)
  let subtotal = 0;
  for (const item of body.items) {
    const resolved = resolveUnitPricePaise(item);
    if (!resolved) return fail(`Product ${item.productId} is unavailable.`, 400);
    subtotal += resolved.paise * item.quantity;
  }

  // Fees come from StoreSetting so the owner can change them without a
  // redeploy. Free-delivery threshold zeros the delivery + handling fee.
  const freeAbove = settings.freeAboveThreshold;
  let discount = 0;
  let deliveryFee = subtotal >= freeAbove ? 0 : settings.deliveryFeeDefault;
  let appliedCoupon: { id: string; code: string } | null = null;

  // Coupon resolution reads the DB — no hardcoded fallback list. If the code
  // doesn't validate (missing, inactive, expired, exhausted, under min-order),
  // we reject the whole order rather than silently dropping the discount:
  // otherwise the customer would see the cart total change on the confirmation
  // screen and lose trust. The Coupon.timesUsed counter is bumped inside the
  // order transaction below so a race can't over-consume a one-shot code.
  if (body.couponCode) {
    const code = body.couponCode.toUpperCase().trim();
    const coupon = await prisma.coupon.findUnique({ where: { code } }).catch(() => null);
    if (!coupon || !coupon.isActive) {
      return fail("This code isn't valid for your order.", 400);
    }
    if (coupon.validUntil && coupon.validUntil < new Date()) {
      return fail("This code has expired.", 400);
    }
    if (coupon.usageLimit != null && coupon.timesUsed >= coupon.usageLimit) {
      return fail("This code has reached its usage limit.", 400);
    }
    if (subtotal < coupon.minOrder) {
      const shortBy = toRupees(coupon.minOrder - subtotal);
      return fail(`Add items worth ₹${shortBy} more to use ${coupon.code}`, 400);
    }
    if (coupon.type === "flat") {
      discount = Math.min(coupon.value, subtotal);
    } else if (coupon.type === "percent") {
      const raw = Math.floor((subtotal * coupon.value) / 100);
      discount = coupon.maxDiscount ? Math.min(raw, coupon.maxDiscount) : raw;
    } else {
      // free_shipping
      deliveryFee = 0;
    }
    appliedCoupon = { id: coupon.id, code: coupon.code };
  }

  // Handling fee is server-controlled (client can't override). Waived when free-delivery threshold hit.
  const handlingFee = subtotal >= freeAbove ? 0 : settings.handlingFeeDefault;
  // Tip is client-controlled (0..N), clamped
  const tipPaise = body.tip != null ? toPaise(Math.max(0, Math.min(body.tip, 1000))) : 0;
  const totalPaise = subtotal - discount + deliveryFee + handlingFee + tipPaise;
  const orderNum = generateOrderNumber();
  let createdOrder: any = null;

  // Sentinel errors from inside the transaction so the outer catch can map
  // them to a proper 4xx instead of a generic 500.
  const OUT_OF_STOCK = Symbol("OUT_OF_STOCK");
  const COUPON_RACE = Symbol("COUPON_RACE");
  let outOfStockName: string | null = null;

  try {
    // Transaction: create order + decrement stock (with guard) + bump coupon usage.
    // Serializable isolation keeps concurrent orders from over-selling the last
    // unit and from over-consuming a one-shot coupon.
    const created = await prisma.$transaction(
      async (tx) => {
      // Conditional stock decrement — updateMany returns count=0 when the row
      // exists but the stock-guard failed, which is exactly the oversell case
      // we need to reject. When the line item names a variant, we decrement
      // that variant's own stock instead of the parent product's — variants
      // carry their own inventory (500 g vs 1 kg packs have separate stock
      // counts) so mutating the product's field would silently drift.
      for (const item of body.items) {
        if (item.variantId) {
          const res = await tx.productVariant.updateMany({
            where: {
              id: item.variantId,
              productId: item.productId,
              stock: { gte: item.quantity },
            },
            data: { stock: { decrement: item.quantity } },
          });
          if (res.count === 0) {
            const p = productMap.get(item.productId);
            const v = variantMap.get(item.variantId);
            outOfStockName = p && v ? `${p.name} (${v.label})` : p?.name ?? item.productId;
            throw OUT_OF_STOCK;
          }
        } else {
          const res = await tx.product.updateMany({
            where: { id: item.productId, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } },
          });
          if (res.count === 0) {
            const p = productMap.get(item.productId);
            outOfStockName = p?.name ?? item.productId;
            throw OUT_OF_STOCK;
          }
        }
      }

      // Coupon usage — atomically bump timesUsed only if it's still under
      // usageLimit. Optimistic lock on the current timesUsed value: if a
      // concurrent transaction bumped it first, updateMany returns count=0
      // and we abort the whole order. Prisma's WHERE can't compare two
      // fields, so we snapshot timesUsed and match on the exact value.
      if (appliedCoupon) {
        const snap = await tx.coupon.findUnique({
          where: { id: appliedCoupon.id },
          select: { timesUsed: true, usageLimit: true, isActive: true },
        });
        if (!snap || !snap.isActive) throw COUPON_RACE;
        if (snap.usageLimit != null && snap.timesUsed >= snap.usageLimit) throw COUPON_RACE;
        const bumped = await tx.coupon.updateMany({
          where: { id: appliedCoupon.id, timesUsed: snap.timesUsed },
          data: { timesUsed: { increment: 1 } },
        });
        if (bumped.count === 0) throw COUPON_RACE;
      }

      const order = await tx.order.create({
        data: {
          orderNumber: orderNum,
          customerId: customer.id,
          customerNameSnap: userName,
          customerPhoneSnap: userPhone,
          deliveryAddress: body.deliveryAddress,
          lat: body.lat,
          lng: body.lng,
          idempotencyKey,
          scheduledFor: scheduledForDate,
          status: "pending",
          subtotal,
          discount,
          deliveryFee,
          handlingFee,
          tip: tipPaise,
          total: totalPaise,
          paymentMethod: body.paymentMethod,
          // Razorpay orders start as "pending" and only flip to "paid" once
          // /api/checkout/razorpay/verify confirms the signature. Pre-marking
          // them as paid at creation meant a cancelled or failed payment still
          // showed up in the customer's history with a green PAID badge.
          paymentStatus: "pending",
          couponCode: appliedCoupon?.code ?? null,
          notes: body.notes,
          items: {
            create: body.items.map((item) => {
              const p = productMap.get(item.productId)!;
              const resolved = resolveUnitPricePaise(item)!;
              return {
                productId: p.id,
                variantId: item.variantId ?? null,
                nameSnap: p.name,
                imageSnap: resolved.image ?? p.imageUrl,
                weightSnap: resolved.label,
                unitPrice: resolved.paise,
                quantity: item.quantity,
              };
            }),
          },
        },
        include: { items: true },
      });

      return order;
    },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    createdOrder = serializeOrder(created);
  } catch (err) {
    if (err === OUT_OF_STOCK) {
      return fail(
        outOfStockName
          ? `Sorry — ${outOfStockName} just went out of stock. Please remove it and try again.`
          : "One of the items in your cart is out of stock. Please refresh and try again.",
        409
      );
    }
    if (err === COUPON_RACE) {
      return fail("This coupon just reached its usage limit. Please try another.", 409);
    }
    // Idempotency-key race: two parallel POSTs with the same key raced past
    // the pre-check. The DB's unique constraint won — resolve to whichever
    // row landed first and return it, same as the fast path above.
    if (
      idempotencyKey &&
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const existing = await prisma.order
        .findUnique({ where: { idempotencyKey }, include: { items: true } })
        .catch(() => null);
      if (existing && existing.customerId === auth.userId) {
        return ok({ order: serializeOrder(existing) }, { status: 200 });
      }
    }
    // No file-DB fabrication fallback. If Prisma can't write, we don't have an
    // order — return 503 so the client can retry with backoff rather than
    // handing the customer a ghost order id that Razorpay verify will 404 on.
    console.error("[/api/orders] order transaction failed:", err);
    return fail("Sorry — we couldn't record your order. Please try again.", 503);
  }

  // Prisma is the only store of record; the JSON file-DB mirror is gone
  // (was per-serverless-instance and quietly produced split-brain state).

  // Confirmation email + SMS — fire-and-forget so a slow SMTP or SMS hop
  // can never hold up the order response. Never throw out of this block.
  const totalRupees = Number(
    createdOrder.total ?? createdOrder.totalPrice ?? toRupees(totalPaise)
  );

  if ((customer as any).email) {
    const tmpl = orderConfirmationEmail({
      to: (customer as any).email,
      customerName: (customer as any).name,
      orderNumber: createdOrder.orderNumber,
      totalRupees,
      itemsCount: body.items.reduce((n, i) => n + i.quantity, 0),
      deliveryAddress: body.deliveryAddress,
      paymentMethod: body.paymentMethod,
    });
    void sendEmail({ to: (customer as any).email, ...tmpl });
  }

  // Order-confirmation SMS. Uses whatever DLT template you registered in
  // MSG91 for the `order_confirmed` status. If none is registered, this
  // no-ops silently — orders still succeed.
  void sendOrderSms({
    phone: userPhone,
    customerName: (customer as any).name ?? userName,
    orderNumber: createdOrder.orderNumber,
    status: "order_confirmed",
    totalRupees,
  });

  return ok({ order: createdOrder }, { status: 201 });
});
