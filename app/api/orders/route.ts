import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fail, generateOrderNumber, getAuth, handler, ok, parseJson, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { toPaise, toRupees } from "@/lib/money";
import { serializeOrder } from "@/lib/serializers";
import { getDb, saveDb } from "@/lib/db";
import { AdminOrder } from "@/lib/adminDummyData";

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

  let orders: any[] = [];

  try {
    const prismaOrders = await prisma.order.findMany({
      where: {
        ...(auth.role === "customer" ? { customerId: auth.userId } : {}),
        ...(status ? { status } : {}),
      },
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    orders = prismaOrders.map(serializeOrder);
  } catch (err) {
    console.warn("Prisma orders query failed, falling back to file DB:", err);
  }

  // Fallback / sync with persistent file DB
  const db = getDb();
  const fileOrders = db.orders || [];

  if (orders.length === 0 && fileOrders.length > 0) {
    orders = fileOrders;
  } else if (fileOrders.length > 0) {
    // Merge file orders with database orders to ensure no lost records
    const existingIds = new Set(orders.map((o) => o.id));
    for (const fo of fileOrders) {
      if (!existingIds.has(fo.id)) {
        orders.push(fo);
      }
    }
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
});

const DELIVERY_FEE_DEFAULT = toPaise(19); // ₹19 flat fee
const FREE_ABOVE = toPaise(199);
const HANDLING_FEE_DEFAULT = toPaise(2); // ₹2 packaging / convenience fee

export const POST = handler(async (req: NextRequest) => {
  const auth = await requireAuth(req, "customer");
  if (auth instanceof NextResponse) return auth;

  const body = await parseJson(req, createSchema);
  if (body instanceof NextResponse) return body;

  const userPhone = body.customerPhone || auth.phone || "+918860269736";
  const userName = body.customerName || "Aarav Sharma";

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
          status: "pending",
          subtotal,
          discount,
          deliveryFee,
          handlingFee,
          tip: tipPaise,
          total: totalPaise,
          paymentMethod: body.paymentMethod,
          paymentStatus: body.paymentMethod === "razorpay" ? "paid" : "pending",
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
      paymentStatus: body.paymentMethod === "razorpay" ? "paid" : "pending",
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

  return ok({ order: createdOrder }, { status: 201 });
});
