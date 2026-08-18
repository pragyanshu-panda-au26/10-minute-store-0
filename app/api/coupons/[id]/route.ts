import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handler, ok, parseJson, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { toPaise } from "@/lib/money";
import { serializeCoupon } from "@/lib/serializers";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  description: z.string().max(300).optional(),
  value: z.number().nonnegative().optional(),
  maxDiscount: z.number().nonnegative().nullable().optional(),
  minOrder: z.number().nonnegative().optional(),
  usageLimit: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
  validUntil: z.string().datetime().nullable().optional(),
});

export const PATCH = handler(async (req: NextRequest, { params }: Params) => {
  const auth = await requireAuth(req, "admin");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const existing = await prisma.coupon.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ success: false, message: "Coupon not found" }, { status: 404 });

  const body = await parseJson(req, patchSchema);
  if (body instanceof NextResponse) return body;

  const coupon = await prisma.coupon.update({
    where: { id },
    data: {
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.value !== undefined ? { value: existing.type === "percent" ? body.value : toPaise(body.value) } : {}),
      ...(body.maxDiscount !== undefined ? { maxDiscount: body.maxDiscount == null ? null : toPaise(body.maxDiscount) } : {}),
      ...(body.minOrder !== undefined ? { minOrder: toPaise(body.minOrder) } : {}),
      ...(body.usageLimit !== undefined ? { usageLimit: body.usageLimit } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      ...(body.validUntil !== undefined ? { validUntil: body.validUntil ? new Date(body.validUntil) : null } : {}),
    },
  });
  return ok({ coupon: serializeCoupon(coupon) });
});

export const DELETE = handler(async (req: NextRequest, { params }: Params) => {
  const auth = await requireAuth(req, "admin");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  await prisma.coupon.delete({ where: { id } });
  return ok({ message: "Coupon deleted" });
});
