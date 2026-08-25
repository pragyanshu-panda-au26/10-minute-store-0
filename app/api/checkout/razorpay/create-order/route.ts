import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Razorpay from "razorpay";
import { fail, handler, ok, parseJson, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { log, requestIdFrom } from "@/lib/log";

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

  const requestId = requestIdFrom(req);

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

  // Razorpay's SDK throws plain-object errors (`{ statusCode, error: {code,
  // description, reason, ...} }`), not `Error` instances. Left uncaught,
  // handler() would swallow them into a generic 500 with `[object Object]`
  // in the log. Catch here so we can (a) log the real reason and (b) tell
  // the client what actually went wrong instead of a bare 500.
  // Razorpay's SDK types `orders.create` with two overloads (promise +
  // callback), and TS picks the void one for `ReturnType`. Widen to `any`
  // for the local binding — the runtime shape is the promise result.
  let rzpOrder: any;
  try {
    rzpOrder = await rzp.orders.create({
      amount: order.total, // paise
      currency: "INR",
      // Razorpay caps receipt at 40 chars — our SL-xxxxxx numbers fit, but
      // guard anyway in case the format changes.
      receipt: order.orderNumber.slice(0, 40),
      notes: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerId: order.customerId ?? "",
      },
    });
  } catch (err) {
    log.error(
      "Razorpay orders.create failed",
      { requestId, route: "/api/checkout/razorpay/create-order", orderId: order.id, amount: order.total },
      err
    );
    // Surface Razorpay's own reason so the checkout UI can show it.
    const e = err as {
      statusCode?: number;
      error?: { code?: string; description?: string; reason?: string };
    };
    const description = e?.error?.description || e?.error?.reason || "Razorpay rejected the order";
    const code = e?.error?.code ? ` (${e.error.code})` : "";
    return fail(`Payment gateway error: ${description}${code}`, 502, e?.error ?? { raw: String(err) });
  }

  // Second guarded step — persist the Razorpay orderId back to our DB.
  // Wrapped separately because a failure here is a very different bug
  // (Prisma / DB) from a Razorpay-side rejection, and the previous
  // "Unhandled route error → [object Object]" log line was almost
  // certainly this branch (the API probe confirmed Razorpay created the
  // order successfully). If a unique-constraint violation fires because
  // this DB row already has a razorpayOrderId (retry after a partial
  // failure), we log-and-ignore — the fresh Razorpay id is what the
  // client will use to actually pay, so returning success is correct.
  try {
    await prisma.order.update({
      where: { id: order.id },
      data: { razorpayOrderId: rzpOrder.id },
    });
  } catch (err) {
    log.error(
      "prisma.order.update(razorpayOrderId) failed",
      {
        requestId,
        route: "/api/checkout/razorpay/create-order",
        orderId: order.id,
        razorpayOrderId: rzpOrder.id,
      },
      err
    );
    // Don't fail the whole checkout — the Razorpay order exists and the
    // client can still complete payment against it. Verify webhook will
    // reconcile via the notes.orderId we stamped above.
  }

  // Sanity-log the key prefix on every request so a mismatch between the
  // server-side `RAZORPAY_KEY_ID` and whatever the browser's checkout is
  // trying to use is immediately visible. Log the prefix only (never the
  // full id — treat it like partial PII) so we don't leak the whole key
  // into log storage. Concrete symptom this catches: a stale/dead key on
  // Vercel silently 401'ing the browser's `/prefill/encrypt` call while
  // the server still happily created the order.
  log.info("Razorpay order handed off to browser", {
    requestId,
    route: "/api/checkout/razorpay/create-order",
    orderId: order.id,
    razorpayOrderId: rzpOrder.id,
    keyIdPrefix: keyId.slice(0, 12),
    mode: keyId.startsWith("rzp_live_") ? "live" : keyId.startsWith("rzp_test_") ? "test" : "unknown",
  });

  return ok({
    razorpayOrderId: rzpOrder.id,
    amount: rzpOrder.amount,
    currency: rzpOrder.currency,
    keyId,
    orderNumber: order.orderNumber,
  });
});
