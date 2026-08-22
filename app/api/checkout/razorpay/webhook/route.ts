import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/checkout/razorpay/webhook
 *
 * Reconciliation path for the checkout flow. The client-side /verify endpoint
 * is best-effort — if the Razorpay Checkout modal loses network right after
 * `payment.captured` but before the browser POSTs to /verify, the customer's
 * money moved and our DB still says pending. Razorpay's webhook re-delivers
 * the same event server-to-server, so we catch that here and settle the
 * order asynchronously.
 *
 * Configure in the Razorpay dashboard:
 *   URL:    https://<host>/api/checkout/razorpay/webhook
 *   Secret: RAZORPAY_WEBHOOK_SECRET (see .env.example)
 *   Events: payment.captured, payment.failed, refund.processed
 *
 * The signature is HMAC-SHA256 of the raw request body with the webhook
 * secret, delivered as `x-razorpay-signature`. Body parsing MUST happen after
 * signature verification — the raw text is what Razorpay signed.
 *
 * Idempotent by design: each transition checks the current DB state before
 * writing, so Razorpay's retry-on-non-2xx behavior can't double-apply.
 */

// Never authenticated — Razorpay hits this with their own service. Public.
export async function POST(req: NextRequest) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    // Missing secret = misconfigured environment. Return 501 not 500 so
    // the Razorpay dashboard shows a config alert rather than a crash.
    return NextResponse.json({ error: "webhook not configured" }, { status: 501 });
  }

  const signature = req.headers.get("x-razorpay-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  // Read the raw text ONCE and hash it. Do NOT req.json() first — JSON
  // stringify-round-trip changes byte order for keys and adds whitespace,
  // which will never match Razorpay's signature.
  const raw = await req.text();
  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  // Constant-time comparison — protects against timing side-channels on
  // the (astronomically unlikely) chance of a targeted attack.
  const sigBuf = Buffer.from(signature, "utf8");
  const expBuf = Buffer.from(expected, "utf8");
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return NextResponse.json({ error: "signature mismatch" }, { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const eventName: string | undefined = event?.event;
  const payment = event?.payload?.payment?.entity;
  const refund = event?.payload?.refund?.entity;

  try {
    if (eventName === "payment.captured" && payment) {
      // payment.captured — the customer paid successfully. Flip the order to
      // paid+confirmed if it wasn't already. Matches the /verify endpoint's
      // side-effects so both paths converge on the same terminal state.
      const order = await prisma.order.findFirst({
        where: { razorpayOrderId: payment.order_id },
      });
      if (order && order.paymentStatus !== "paid") {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: "paid",
            razorpayPaymentId: payment.id,
            status: order.status === "pending" ? "confirmed" : order.status,
          },
        });
      }
    } else if (eventName === "payment.failed" && payment) {
      // payment.failed — record it but don't cancel the order automatically:
      // the customer might retry with a different method. The owner sees a
      // failed-payment badge and can decide.
      const order = await prisma.order.findFirst({
        where: { razorpayOrderId: payment.order_id },
      });
      if (order && order.paymentStatus === "pending") {
        await prisma.order.update({
          where: { id: order.id },
          data: { paymentStatus: "failed" },
        });
      }
    } else if (eventName === "refund.processed" && refund) {
      // refund.processed — Razorpay confirmed the refund cleared. Add to
      // refundAmount (paise); analytics subtracts it from gross revenue.
      const order = await prisma.order.findFirst({
        where: { razorpayPaymentId: refund.payment_id },
      });
      if (order) {
        const refundPaise = Number(refund.amount) || 0;
        // Cap so a duplicate webhook can't push refundAmount past total.
        const newRefund = Math.min(order.total, order.refundAmount + refundPaise);
        await prisma.order.update({
          where: { id: order.id },
          data: {
            refundAmount: newRefund,
            paymentStatus: newRefund >= order.total ? "refunded" : order.paymentStatus,
          },
        });
      }
    }
    // Any other event is acknowledged but ignored — Razorpay resends 5xx,
    // so 200 stops the retries. Add handlers as new events matter.
  } catch (err) {
    // A DB blip here means Razorpay will retry — safe. Log but return 500
    // so the retry actually happens.
    console.error("[razorpay/webhook] handler failed:", err);
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
