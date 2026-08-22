import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fail, getAuth, handler, ok, parseJson } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { toPaise, toRupees } from "@/lib/money";
import { enforceRateLimit } from "@/lib/rateLimit";

const bodySchema = z.object({
  code: z.string().min(1).max(40),
  subtotal: z.number().nonnegative(),
});

/**
 * POST /api/coupons/validate
 * Body: { code, subtotal (rupees) }
 * Public: called from the cart drawer. Returns the resolved discount.
 */
export const POST = handler(async (req: NextRequest) => {
  // Coupon-validate is unauthenticated on purpose — the cart drawer needs it.
  // Without a rate limit it's a trivial enumerator for every live code and
  // its min-order threshold. Tight per-IP window here.
  const denied = enforceRateLimit(req, {
    bucket: "coupons-validate",
    perMinute: 15,
    perHour: 120,
  });
  if (denied) return denied;

  const body = await parseJson(req, bodySchema);
  if (body instanceof NextResponse) return body;

  // Authenticated customers get useful error text ("Add ₹X more to use CODE").
  // Anonymous callers only get a single generic message so they can't
  // enumerate live codes or discover minOrder thresholds by watching messages.
  const auth = await getAuth(req);
  const isCustomer = auth?.role === "customer";

  const subtotalPaise = toPaise(body.subtotal);
  const coupon = await prisma.coupon.findUnique({
    where: { code: body.code.toUpperCase().trim() },
  });

  const INVALID_MSG = "This code isn't valid for your order.";
  if (!coupon || !coupon.isActive) return fail(INVALID_MSG, 400);
  if (coupon.validUntil && coupon.validUntil < new Date()) return fail(INVALID_MSG, 400);
  if (coupon.usageLimit != null && coupon.timesUsed >= coupon.usageLimit) {
    return fail(INVALID_MSG, 400);
  }
  if (subtotalPaise < coupon.minOrder) {
    if (!isCustomer) return fail(INVALID_MSG, 400);
    const shortBy = toRupees(coupon.minOrder - subtotalPaise);
    return fail(`Add items worth ₹${shortBy} more to use ${coupon.code}`, 400);
  }

  let discountPaise = 0;
  let freeShipping = false;
  if (coupon.type === "flat") {
    discountPaise = Math.min(coupon.value, subtotalPaise);
  } else if (coupon.type === "percent") {
    const raw = Math.floor((subtotalPaise * coupon.value) / 100);
    discountPaise = coupon.maxDiscount ? Math.min(raw, coupon.maxDiscount) : raw;
  } else {
    freeShipping = true;
    discountPaise = coupon.value; // shipping-fee value
  }

  return ok({
    valid: true,
    code: coupon.code,
    description: coupon.description ?? "",
    type: coupon.type,
    discount: toRupees(discountPaise),
    freeShipping,
  });
});
