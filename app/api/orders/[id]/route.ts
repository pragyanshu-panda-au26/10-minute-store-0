import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fail, getAuth, handler, ok, parseJson, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { serializeOrder } from "@/lib/serializers";
import { getDb, saveDb } from "@/lib/db";
import { orderStatusEmail, sendEmail } from "@/lib/email";
import { sendOrderSms, OrderSmsStatus } from "@/lib/sms";
import { sendPushToCustomer } from "@/lib/push";

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

  // Status-change email — fire and forget. Only emails on the transitions
  // customers actually care about; "pending" is the state a new order is
  // created in so notifying on it would fire twice for every purchase.
  try {
    const notify = ["confirmed", "packed", "out_for_delivery", "delivered", "cancelled"] as const;
    type NotifyStatus = (typeof notify)[number];
    const isNotify = (s: string): s is NotifyStatus => (notify as readonly string[]).includes(s);

    const customerId = (updatedOrderResult as any).customerId;
    if (customerId && isNotify(body.status)) {
      const customer = await prisma.customer
        .findUnique({ where: { id: customerId }, select: { email: true, name: true, phone: true } })
        .catch(() => null);
      const orderNumber =
        (updatedOrderResult as any).orderNumber ?? (updatedOrderResult as any).id;

      // Email — where we have one on file
      if (customer?.email) {
        const tmpl = orderStatusEmail({
          to: customer.email,
          customerName: customer.name,
          orderNumber,
          status: body.status,
        });
        void sendEmail({ to: customer.email, ...tmpl });
      }

      // Web push — one call fans out to every subscribed device on that
      // customer id. Tag with the order number so a re-notification for
      // the same order replaces the previous rather than stacking.
      const pushCopy: Record<NotifyStatus, { title: string; body: string }> = {
        confirmed:        { title: "Order confirmed",    body: `#${orderNumber} — the store owner is packing your order.` },
        packed:           { title: "Order packed",       body: `#${orderNumber} — ready to head out to you.` },
        out_for_delivery: { title: "On the way",         body: `#${orderNumber} — the shop owner is on the way.` },
        delivered:        { title: "Delivered",          body: `#${orderNumber} — enjoy! Reply here if anything's off.` },
        cancelled:        { title: "Order cancelled",    body: `#${orderNumber} has been cancelled.` },
      };
      const copy = pushCopy[body.status as NotifyStatus];
      if (copy) {
        void sendPushToCustomer(customerId, {
          title: copy.title,
          body: copy.body,
          url: `/orders/${orderNumber}/track`,
          tag: `order:${orderNumber}`,
        });
      }

      // SMS — always attempt; sendOrderSms silently no-ops if no template
      // is configured for this status, so it's safe to fire on every event
      // and roll out templates one at a time in the MSG91 dashboard.
      if (customer?.phone) {
        // Map internal status → SMS template key. "packed" collapses into
        // the "confirmed" template since customers rarely need two updates
        // that close together and DLT templates cost money to register.
        const smsStatus: Record<
          "confirmed" | "packed" | "out_for_delivery" | "delivered" | "cancelled",
          "order_confirmed" | "order_out_for_delivery" | "order_delivered" | "order_cancelled"
        > = {
          confirmed:        "order_confirmed",
          packed:           "order_confirmed",
          out_for_delivery: "order_out_for_delivery",
          delivered:        "order_delivered",
          cancelled:        "order_cancelled",
        };
        void sendOrderSms({
          phone: customer.phone,
          customerName: customer.name,
          orderNumber,
          status: smsStatus[body.status],
          totalRupees: Number((updatedOrderResult as any).total ?? (updatedOrderResult as any).totalPrice ?? 0),
        });
      }
    }
  } catch (err) {
    console.warn("[orders/:id] status notification dispatch failed:", err);
  }

  return ok({ order: updatedOrderResult });
});
