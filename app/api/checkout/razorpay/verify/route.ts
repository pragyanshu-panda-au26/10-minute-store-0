import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { fail, handler, ok, parseJson, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { serializeOrder } from "@/lib/serializers";

/**
 * POST /api/checkout/razorpay/verify
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 *
 * Server-side signature verification per Razorpay spec:
 *   expected = HMAC_SHA256(razorpay_order_id + "|" + razorpay_payment_id, KEY_SECRET)
 * On success, mark the order as paid and confirm it.
 */
const bodySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

export const POST = handler(async (req: NextRequest) => {
  const auth = await requireAuth(req, "customer");
  if (auth instanceof NextResponse) return auth;

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) return fail("Razorpay is not configured", 501);

  const body = await parseJson(req, bodySchema);
  if (body instanceof NextResponse) return body;

  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(`${body.razorpay_order_id}|${body.razorpay_payment_id}`)
    .digest("hex");

  if (expected !== body.razorpay_signature) {
    return fail("Payment signature mismatch", 400);
  }

  const order = await prisma.order.findFirst({
    where: {
      razorpayOrderId: body.razorpay_order_id,
      customerId: auth.userId,
    },
    include: { items: true },
  });
  if (!order) return fail("Order not found", 404);

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentStatus: "paid",
      razorpayPaymentId: body.razorpay_payment_id,
      status: order.status === "pending" ? "confirmed" : order.status,
    },
    include: { items: true },
  });

  return ok({ order: serializeOrder(updated) });
});
