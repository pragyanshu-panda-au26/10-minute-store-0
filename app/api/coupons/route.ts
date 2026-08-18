import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handler, ok, parseJson, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { toPaise } from "@/lib/money";
import { serializeCoupon } from "@/lib/serializers";

export const GET = handler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const includeInactive = searchParams.get("includeInactive") === "true";
  const coupons = await prisma.coupon.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: { createdAt: "desc" },
  });
  return ok({ coupons: coupons.map(serializeCoupon) });
});

const createSchema = z.object({
  code: z.string().min(2).max(40).transform((s) => s.toUpperCase().trim()),
  description: z.string().max(300).optional(),
  type: z.enum(["flat", "percent", "free_shipping"]),
  // For percent: 0-100. For flat/free_shipping: rupees.
  value: z.number().nonnegative(),
  maxDiscount: z.number().nonnegative().optional(),
  minOrder: z.number().nonnegative().default(0),
  usageLimit: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
  validUntil: z.string().datetime().optional(),
});

export const POST = handler(async (req: NextRequest) => {
  const auth = await requireAuth(req, "admin");
  if (auth instanceof NextResponse) return auth;
  const body = await parseJson(req, createSchema);
  if (body instanceof NextResponse) return body;

  const coupon = await prisma.coupon.create({
    data: {
      code: body.code,
      description: body.description,
      type: body.type,
      value: body.type === "percent" ? body.value : toPaise(body.value),
      maxDiscount: body.maxDiscount != null ? toPaise(body.maxDiscount) : null,
      minOrder: toPaise(body.minOrder),
      usageLimit: body.usageLimit,
      isActive: body.isActive ?? true,
      validUntil: body.validUntil ? new Date(body.validUntil) : null,
    },
  });
  return ok({ coupon: serializeCoupon(coupon) }, { status: 201 });
});
