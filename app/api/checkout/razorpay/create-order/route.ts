import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Razorpay from "razorpay";
import { fail, handler, ok, parseJson, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/checkout/razorpay/create-order
 * Body: { orderId }  (our internal DB order id or orderNumber)
 *
 * Creates a Razorpay order matching the DB order total and returns
 * the Razorpay orderId + public key so the client can open the checkout.
 * The DB order must already exist (in status "pending") — created by
 * POST /api/orders.
 */
const bodySchema = z.object({ orderId: z.string().min(1) });

export const POST = handler(async (req: NextRequest) => {
  const auth = await requireAuth(req, "customer");
  if (auth instanceof NextResponse) return auth;

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return fail(
      "Razorpay is not configured on the server. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
      501
    );
  }

  const body = await parseJson(req, bodySchema);
  if (body instanceof NextResponse) return body;

  const order = await prisma.order.findFirst({
    where: {
      OR: [{ id: body.orderId }, { orderNumber: body.orderId }],
      customerId: auth.userId,
    },
  });
  if (!order) return fail("Order not found", 404);
  if (order.paymentMethod !== "razorpay") return fail("Order is not a Razorpay order", 400);
  if (order.paymentStatus === "paid") return fail("Order already paid", 409);

  const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });
  const rzpOrder = await rzp.orders.create({
    amount: order.total, // paise
    currency: "INR",
    receipt: order.orderNumber,
    notes: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerId: order.customerId ?? "",
    },
  });

  await prisma.order.update({
    where: { id: order.id },
    data: { razorpayOrderId: rzpOrder.id },
  });

  return ok({
    razorpayOrderId: rzpOrder.id,
    amount: rzpOrder.amount,
    currency: rzpOrder.currency,
    keyId,
    orderNumber: order.orderNumber,
  });
});
