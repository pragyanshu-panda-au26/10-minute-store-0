import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fail, generateOrderNumber, getAuth, handler, ok, parseJson, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { toPaise, toRupees } from "@/lib/money";
import { serializeOrder } from "@/lib/serializers";
import { getDb, saveDb } from "@/lib/db";
import { AdminOrder } from "@/lib/adminDummyData";
import { computeOpenState, getStoreSettings } from "@/lib/storeSettings";
import { validateSlotBooking } from "@/lib/deliverySlots";
import { orderConfirmationEmail, sendEmail } from "@/lib/email";
import { sendOrderSms } from "@/lib/sms";

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
});

const DELIVERY_FEE_DEFAULT = toPaise(19); // ₹19 flat fee
const FREE_ABOVE = toPaise(199);
const HANDLING_FEE_DEFAULT = toPaise(2); // ₹2 packaging / convenience fee

export const POST = handler(async (req: NextRequest) => {
  const auth = await requireAuth(req, "customer");
  if (auth instanceof NextResponse) return auth;

  const body = await parseJson(req, createSchema);
  if (body instanceof NextResponse) return body;

  // Store must be open to accept new orders. Admin toggles via /admin/settings.
  // Also: if a slot is requested, it must be valid + have capacity.
  let scheduledForDate: Date | null = null;
  try {
    const settings = await getStoreSettings();
    const openState = computeOpenState(settings);

    // If a slot is booked we allow orders EVEN while the store is closed —
    // slot orders are for future fulfillment. Instant orders still require open.
    if (body.scheduledFor) {
      scheduledForDate = new Date(body.scheduledFor);
      if (!Number.isFinite(scheduledForDate.getTime())) {
        return fail("Invalid scheduledFor timestamp", 400);
      }
      const rejection = await validateSlotBooking(scheduledForDate, settings);
      if (rejection) return fail(rejection, 409);
    } else if (!openState.open) {
      return fail(
        openState.reason || "Store is currently closed. Please try again shortly.",
        503
      );
    }
  } catch (err) {
    // If we can't read settings (rare — DB blip), assume open rather than
    // blocking customers. The store owner will notice via other channels.
    console.warn("[orders] store settings read failed, assuming open:", err);
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

  // Ensure Customer record exists in Prisma DB before order placement
  let customer;
  try {
    customer = await prisma.customer.upsert({
      where: { id: auth.userId },
      update: { name: userName, phone: userPhone },
      create: { id: auth.userId, phone: userPhone, name: userName },
    });
  } catch (err) {
    console.warn("Prisma customer upsert fallback:", err);
    customer = { id: auth.userId, phone: userPhone, name: userName, isBlocked: false };
  }

  if (customer.isBlocked) return fail("Account is blocked", 403);

  // Fetch products + variants referenced
  const productIds = body.items.map((i) => i.productId);
  const variantIds = body.items
    .map((i) => i.variantId)
    .filter((v): v is string => Boolean(v));
  let products: any[] = [];
  let variants: any[] = [];
  try {
    products = await prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
    });
    if (variantIds.length > 0) {
      variants = await prisma.productVariant.findMany({
        where: { id: { in: variantIds } },
      });
    }
  } catch (e) {}

  // Fallback to file DB products if Prisma products query empty
  if (products.length === 0) {
    const fileProducts = getDb().products || [];
    products = fileProducts.filter((p) => productIds.includes(p.id));
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
        return {
          paise: v.price, // always in paise from DB
          label: v.label,
          image: v.imageUrl,
        };
      }
    }
    const p = productMap.get(item.productId);
    if (!p) return null;
    // File-DB fallback stores rupees (< 1000), Prisma stores paise
    const paise = p.price > 1000 ? p.price : toPaise(p.price);
    return { paise, label: p.weight, image: p.imageUrl };
  };

  // Validate + compute subtotal (paise)
  let subtotal = 0;
  for (const item of body.items) {
    const resolved = resolveUnitPricePaise(item);
    if (!resolved) return fail(`Product ${item.productId} is unavailable.`, 400);
    subtotal += resolved.paise * item.quantity;
  }

  let discount = 0;
  let deliveryFee = subtotal >= FREE_ABOVE ? 0 : DELIVERY_FEE_DEFAULT;

  if (body.couponCode) {
    const code = body.couponCode.toUpperCase().trim();
    if (code === "SATYUG50" || code === "SATYUG40") {
      discount = Math.min(toPaise(50), subtotal);
    } else if (code === "FREESHIP") {
      deliveryFee = 0;
    }
  }

  // Handling fee is server-controlled (client can't override). Waived when free-delivery threshold hit.
  const handlingFee = subtotal >= FREE_ABOVE ? 0 : HANDLING_FEE_DEFAULT;
  // Tip is client-controlled (0..N), clamped
  const tipPaise = body.tip != null ? toPaise(Math.max(0, Math.min(body.tip, 1000))) : 0;
  const totalPaise = subtotal - discount + deliveryFee + handlingFee + tipPaise;
  const orderNum = generateOrderNumber();
  let createdOrder: any = null;

  try {
    // Transaction: create order + decrement stock
    const created = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNumber: orderNum,
          customerId: customer.id,
          customerNameSnap: userName,
          customerPhoneSnap: userPhone,
          deliveryAddress: body.deliveryAddress,
          lat: body.lat,
          lng: body.lng,
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
// /api/checkout/razorpay/verify confirms the signature. Pre-marking them
// as paid at creation meant a cancelled or failed payment still showed up
// in the customer's history with a green PAID badge.
paymentStatus: "pending",
          couponCode: body.couponCode ?? null,
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

      for (const item of body.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        }).catch(() => {});
      }

      return order;
    });

    createdOrder = serializeOrder(created);
  } catch (err) {
    console.warn("Prisma order transaction error, using file DB persistence fallback:", err);

    // Fallback serialized order construction for File DB
    createdOrder = {
      id: "ord_" + Date.now(),
      orderNumber: orderNum,
      customerId: customer.id,
      customerName: userName,
      customerPhone: userPhone,
      deliveryAddress: body.deliveryAddress,
      status: "pending",
      subtotal: toRupees(subtotal),
      discount: toRupees(discount),
      deliveryFee: toRupees(deliveryFee),
      total: toRupees(totalPaise),
      totalPrice: toRupees(totalPaise),
      totalItems: body.items.reduce((n, i) => n + i.quantity, 0),
      paymentMethod: body.paymentMethod,
      // Razorpay orders start as "pending" and only flip to "paid" once
// /api/checkout/razorpay/verify confirms the signature. Pre-marking them
// as paid at creation meant a cancelled or failed payment still showed up
// in the customer's history with a green PAID badge.
paymentStatus: "pending",
      couponCode: body.couponCode ?? null,
      createdAt: new Date().toISOString(),
      items: body.items.map((item) => {
        const p = productMap.get(item.productId)!;
        return {
          id: "item_" + Math.random().toString(36).substr(2, 6),
          productId: p.id,
          name: p.name,
          imageUrl: p.imageUrl,
          weight: p.weight,
          price: p.price > 1000 ? toRupees(p.price) : p.price,
          quantity: item.quantity,
        };
      }),
    };
  }

  // Dual-Store Sync: Persist order into file database `data/satyug_db.json`
  try {
    const fileDb = getDb();
    if (!fileDb.orders) fileDb.orders = [];
    fileDb.orders.unshift(createdOrder as AdminOrder);
    saveDb(fileDb);
  } catch (e) {
    console.warn("File DB save order error:", e);
  }

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
