import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fail, handler, ok, parseJson } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { toPaise, toRupees } from "@/lib/money";

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
  const body = await parseJson(req, bodySchema);
  if (body instanceof NextResponse) return body;

  const subtotalPaise = toPaise(body.subtotal);
  const coupon = await prisma.coupon.findUnique({
    where: { code: body.code.toUpperCase().trim() },
  });

  if (!coupon || !coupon.isActive) return fail("Invalid promo code", 400);
  if (coupon.validUntil && coupon.validUntil < new Date()) return fail("Coupon expired", 400);
  if (coupon.usageLimit != null && coupon.timesUsed >= coupon.usageLimit) {
    return fail("Coupon usage limit reached", 400);
  }
  if (subtotalPaise < coupon.minOrder) {
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
