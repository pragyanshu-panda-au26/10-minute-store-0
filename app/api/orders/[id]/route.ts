import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fail, getAuth, handler, ok, parseJson, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { serializeOrder } from "@/lib/serializers";
import { getDb, saveDb } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export const GET = handler(async (req: NextRequest, { params }: Params) => {
  const auth = await getAuth(req);
  if (!auth) return fail("Authentication required", 401);

  const { id } = await params;
  let orderResult: any = null;

  try {
    const prismaOrder = await prisma.order.findFirst({
      where: {
        OR: [{ id }, { orderNumber: id }],
      },
      include: { items: true },
    });
    if (prismaOrder) {
      orderResult = serializeOrder(prismaOrder);
    }
  } catch (err) {
    console.warn("Prisma order lookup failed:", err);
  }

  // Fallback file DB lookup
  if (!orderResult) {
    const fileOrders = getDb().orders || [];
    const found = fileOrders.find((o) => o.id === id || o.orderNumber === id);
    if (found) {
      orderResult = found;
    }
  }

  if (!orderResult) return fail("Order not found", 404);
  return ok({ order: orderResult });
});

const statusSchema = z.object({
  status: z.enum([
    "pending",
    "confirmed",
    "packed",
    "out_for_delivery",
    "delivered",
    "cancelled",
  ]),
});

/**
 * PATCH /api/orders/:id
 * Admin-only: transition status. On "delivered"/"cancelled" we stamp timestamps.
 */
export const PATCH = handler(async (req: NextRequest, { params }: Params) => {
  const auth = await getAuth(req);
  if (!auth) return fail("Authentication required", 401);

  const { id } = await params;
  const body = await parseJson(req, statusSchema);
  if (body instanceof NextResponse) return body;

  let updatedOrderResult: any = null;

  try {
    const existing = await prisma.order.findFirst({
      where: { OR: [{ id }, { orderNumber: id }] },
      include: { items: true },
    });

    if (existing) {
      // Customers may only cancel their OWN order, and only while it's still
      // pending and unpaid — this lets the checkout page clean up an order
      // whose Razorpay flow was dismissed or failed. Any other transition
      // remains admin-only.
      if (auth.role !== "admin") {
        const isSelf = existing.customerId === auth.userId;
        const isPendingUnpaid =
          existing.status === "pending" && existing.paymentStatus !== "paid";
        if (!isSelf || body.status !== "cancelled" || !isPendingUnpaid) {
          return fail("Forbidden", 403);
        }
      }
      const updated = await prisma.$transaction(async (tx) => {
        if (body.status === "cancelled" && existing.status !== "cancelled") {
          for (const item of existing.items) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { increment: item.quantity } },
            }).catch(() => {});
          }
        }

        return tx.order.update({
          where: { id: existing.id },
          data: {
            status: body.status,
            ...(body.status === "delivered" ? { deliveredAt: new Date(), paymentStatus: existing.paymentMethod === "cod" ? "paid" : existing.paymentStatus } : {}),
            ...(body.status === "cancelled" ? { cancelledAt: new Date() } : {}),
          },
          include: { items: true },
        });
      });

      updatedOrderResult = serializeOrder(updated);
    }
  } catch (err) {
    console.warn("Prisma order update error:", err);
  }

  // Update in file DB as well for persistent dual-sync
  const fileDb = getDb();
  if (fileDb.orders) {
    fileDb.orders = fileDb.orders.map((o) =>
      o.id === id || o.orderNumber === id ? { ...o, status: body.status } : o
    );
    saveDb(fileDb);

    if (!updatedOrderResult) {
      updatedOrderResult = fileDb.orders.find((o) => o.id === id || o.orderNumber === id);
    }
  }

  if (!updatedOrderResult) return fail("Order not found", 404);
  return ok({ order: updatedOrderResult });
});
