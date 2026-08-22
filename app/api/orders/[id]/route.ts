import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fail, getAuth, handler, ok, parseJson, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { serializeOrder } from "@/lib/serializers";
import { orderStatusEmail, sendEmail } from "@/lib/email";
import { sendOrderSms, OrderSmsStatus } from "@/lib/sms";
import { sendPushToCustomer } from "@/lib/push";

type Params = { params: Promise<{ id: string }> };

export const GET = handler(async (req: NextRequest, { params }: Params) => {
  const auth = await getAuth(req);
  if (!auth) return fail("Authentication required", 401);

  const { id } = await params;

  // Prisma is the single source of truth on read. The old file-DB fallback
  // was ephemeral per serverless instance — a hit there meant the tab across
  // the browser could show a different order state than this one.
  let prismaOrder;
  try {
    prismaOrder = await prisma.order.findFirst({
      where: { OR: [{ id }, { orderNumber: id }] },
      include: { items: true },
    });
  } catch (err) {
    console.error("[/api/orders/:id] Prisma lookup failed:", err);
    return fail("Orders service temporarily unavailable. Please try again.", 503);
  }
  if (!prismaOrder) return fail("Order not found", 404);

  // Customers may only read their own orders.
  if (auth.role !== "admin" && prismaOrder.customerId !== auth.userId) {
    return fail("Order not found", 404);
  }

  return ok({ order: serializeOrder(prismaOrder) });
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
 *
 * The one authorized customer path is self-cancel while the order is still
 * pending + unpaid (Razorpay dismissed / failed). Everything else — accepting,
 * packing, dispatching, delivering, cancelling someone else's order — is admin
 * only. Historically this route only gated `getAuth` and relied on an in-body
 * check to reject non-admins from non-cancel transitions, but if an existing
 * order couldn't be loaded (Prisma blip, wrong id) the check was skipped
 * entirely and a customer could still poke arbitrary status writes at the
 * file-DB fallback. Now we gate BEFORE the DB lookup: admins may do anything;
 * customers may only PATCH status: "cancelled" on their own pending-unpaid
 * orders. Any other combination is a hard 403.
 */
export const PATCH = handler(async (req: NextRequest, { params }: Params) => {
  const auth = await getAuth(req);
  if (!auth) return fail("Authentication required", 401);

  const { id } = await params;
  const body = await parseJson(req, statusSchema);
  if (body instanceof NextResponse) return body;

  // Fast-path rejection for non-admin non-cancels — no DB round-trip needed.
  if (auth.role !== "admin" && body.status !== "cancelled") {
    return fail("Forbidden", 403);
  }

  let existing;
  try {
    existing = await prisma.order.findFirst({
      where: { OR: [{ id }, { orderNumber: id }] },
      include: { items: true },
    });
  } catch (err) {
    console.error("[/api/orders/:id] Prisma lookup failed:", err);
    return fail("Orders service temporarily unavailable. Please try again.", 503);
  }
  if (!existing) return fail("Order not found", 404);

  // Customers may only cancel their OWN order, and only while it's still
  // pending and unpaid. Admins can transition anything.
  if (auth.role !== "admin") {
    const isSelf = existing.customerId === auth.userId;
    const isPendingUnpaid =
      existing.status === "pending" && existing.paymentStatus !== "paid";
    if (!isSelf || !isPendingUnpaid) {
      return fail("Forbidden", 403);
    }
  }

  let updatedOrderResult: any;
  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (body.status === "cancelled" && existing.status !== "cancelled") {
        // Restore stock — variant-aware, mirrors the debit path in the
        // create route. Non-variant lines mutate the product; variant lines
        // mutate the variant row.
        for (const item of existing.items) {
          if (item.variantId) {
            await tx.productVariant.update({
              where: { id: item.variantId },
              data: { stock: { increment: item.quantity } },
            }).catch(() => {});
          } else {
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { increment: item.quantity } },
            }).catch(() => {});
          }
        }
      }

      return tx.order.update({
        where: { id: existing.id },
        data: {
          status: body.status,
          ...(body.status === "delivered"
            ? {
                deliveredAt: new Date(),
                paymentStatus:
                  existing.paymentMethod === "cod" ? "paid" : existing.paymentStatus,
              }
            : {}),
          ...(body.status === "cancelled" ? { cancelledAt: new Date() } : {}),
        },
        include: { items: true },
      });
    });
    updatedOrderResult = serializeOrder(updated);
  } catch (err) {
    console.error("[/api/orders/:id] Prisma update failed:", err);
    return fail("Could not update order. Please try again.", 503);
  }

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
