import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fail, handleOptions, handler, ok, parseJson, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { toPaise } from "@/lib/money";

type Params = { params: Promise<{ id: string; variantId: string }> };

const patchSchema = z.object({
  label: z.string().min(1).max(60).optional(),
  price: z.number().positive().optional(),
  originalPrice: z.number().positive().nullable().optional(),
  stock: z.number().int().nonnegative().optional(),
  imageUrl: z.string().url().nullable().optional(),
  sortOrder: z.number().int().optional(),
  isDefault: z.boolean().optional(),
});

export const PATCH = handler(async (req: NextRequest, { params }: Params) => {
  const auth = await requireAuth(req, "admin");
  if (auth instanceof NextResponse) return auth;
  const { id, variantId } = await params;
  const body = await parseJson(req, patchSchema);
  if (body instanceof NextResponse) return body;

  const existing = await prisma.productVariant.findFirst({
    where: { id: variantId, productId: id },
  });
  if (!existing) return fail("Variant not found", 404);

  const variant = await prisma.$transaction(async (tx) => {
    if (body.isDefault) {
      await tx.productVariant.updateMany({
        where: { productId: id, NOT: { id: variantId } },
        data: { isDefault: false },
      });
    }
    return tx.productVariant.update({
      where: { id: variantId },
      data: {
        ...(body.label !== undefined ? { label: body.label } : {}),
        ...(body.price !== undefined ? { price: toPaise(body.price) } : {}),
        ...(body.originalPrice !== undefined
          ? { originalPrice: body.originalPrice == null ? null : toPaise(body.originalPrice) }
          : {}),
        ...(body.stock !== undefined ? { stock: body.stock } : {}),
        ...(body.imageUrl !== undefined ? { imageUrl: body.imageUrl } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
        ...(body.isDefault !== undefined ? { isDefault: body.isDefault } : {}),
      },
    });
  });
  return ok({ variant });
});

export const DELETE = handler(async (req: NextRequest, { params }: Params) => {
  const auth = await requireAuth(req, "admin");
  if (auth instanceof NextResponse) return auth;
  const { id, variantId } = await params;
  const existing = await prisma.productVariant.findFirst({
    where: { id: variantId, productId: id },
  });
  if (!existing) return fail("Variant not found", 404);
  await prisma.productVariant.delete({ where: { id: variantId } });
  return ok({ message: "Variant deleted" });
});

export const OPTIONS = handleOptions;
