import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";
import { z } from "zod";
import { fail, handleOptions, handler, ok, parseJson, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { toPaise, toRupees } from "@/lib/money";
import { serializeOrder } from "@/lib/serializers";

/**
 * POST /api/orders/:id/refund
 * Admin-only. Issues a full or partial Razorpay refund to the original source
 * (UPI / card / wallet). COD orders are marked refunded in the DB only —
 * no gateway call because the cash never left Razorpay.
 *
 * Body: { amount?: number }   (rupees; omit for full refund of what's paid)
 */

const bodySchema = z.object({
  amount: z.number().positive().max(1_000_000).optional(),
});

type Params = { params: Promise<{ id: string }> };

export const POST = handler(async (req: NextRequest, { params }: Params) => {
  const auth = await requireAuth(req, "admin");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await parseJson(req, bodySchema);
  if (body instanceof NextResponse) return body;

  const order = await prisma.order.findFirst({
    where: { OR: [{ id }, { orderNumber: id }] },
    include: { items: true },
  });
  if (!order) return fail("Order not found", 404);

  if (order.paymentStatus === "refunded") {
    return fail("Order is already refunded", 409);
  }
  if (order.paymentStatus !== "paid") {
    return fail("Order isn't paid — nothing to refund", 400);
  }

  const alreadyRefundedPaise = order.refundAmount ?? 0;
  const refundablePaise = order.total - alreadyRefundedPaise;
  const requestedPaise = body.amount ? toPaise(body.amount) : refundablePaise;
  if (requestedPaise <= 0 || requestedPaise > refundablePaise) {
    return fail(
      `Refund must be between ₹1 and ₹${toRupees(refundablePaise)} (refundable amount)`,
      400
    );
  }

  // ── Razorpay path
  if (order.paymentMethod === "razorpay") {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) return fail("Razorpay is not configured on the server", 501);
    if (!order.razorpayPaymentId) return fail("Order has no Razorpay payment id", 400);

    const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });
    try {
      const refund = await rzp.payments.refund(order.razorpayPaymentId, {
        amount: requestedPaise,
        speed: "normal",
        notes: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          admin: auth.userId,
        },
      });
      console.log(`[refund] razorpay id=${refund.id} amount=${requestedPaise} order=${order.orderNumber}`);
    } catch (err: any) {
      console.error("[refund] razorpay error:", err);
      return fail(err?.error?.description ?? err?.message ?? "Razorpay refund failed", 502);
    }
  } else {
    // COD — nothing to refund at the gateway, we just record it.
    console.log(`[refund] COD marked-refunded ₹${toRupees(requestedPaise)} order=${order.orderNumber}`);
  }

  const totalRefundedNow = alreadyRefundedPaise + requestedPaise;
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      refundAmount: totalRefundedNow,
      paymentStatus: totalRefundedNow >= order.total ? "refunded" : "paid",
    },
    include: { items: true },
  });

  return ok({
    order: serializeOrder(updated),
    refunded: toRupees(requestedPaise),
    totalRefunded: toRupees(totalRefundedNow),
  });
});

export const OPTIONS = handleOptions;
