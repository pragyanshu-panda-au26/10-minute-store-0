import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fail, handler, ok, parseJson, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { toPaise } from "@/lib/money";
import { serializeProduct } from "@/lib/serializers";

type Params = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: NextRequest, { params }: Params) => {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: { subcategory: true },
  });
  if (!product) return fail("Product not found", 404);
  return ok({ product: serializeProduct(product) });
});

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  category: z.string().optional(),
  subcategoryId: z.string().nullable().optional(),
  price: z.number().positive().optional(),
  originalPrice: z.number().positive().nullable().optional(),
  costPrice: z.number().nonnegative().nullable().optional(),
  stock: z.number().int().nonnegative().optional(),
  weight: z.string().min(1).max(60).optional(),
  imageUrl: z.string().url().optional(),
  rating: z.number().min(0).max(5).optional(),
  tags: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export const PATCH = handler(async (req: NextRequest, { params }: Params) => {
  const auth = await requireAuth(req, "admin");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await parseJson(req, patchSchema);
  if (body instanceof NextResponse) return body;

  const product = await prisma.product.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.category !== undefined ? { categoryId: body.category } : {}),
      ...(body.subcategoryId !== undefined ? { subcategoryId: body.subcategoryId } : {}),
      ...(body.price !== undefined ? { price: toPaise(body.price) } : {}),
      ...(body.originalPrice !== undefined
        ? { originalPrice: body.originalPrice == null ? null : toPaise(body.originalPrice) }
        : {}),
      ...(body.costPrice !== undefined
        ? { costPrice: body.costPrice == null ? null : toPaise(body.costPrice) }
        : {}),
      ...(body.stock !== undefined ? { stock: body.stock } : {}),
      ...(body.weight !== undefined ? { weight: body.weight } : {}),
      ...(body.imageUrl !== undefined ? { imageUrl: body.imageUrl } : {}),
      ...(body.rating !== undefined ? { rating: body.rating } : {}),
      ...(body.tags !== undefined ? { tags: body.tags } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    },
    include: { subcategory: true },
  });
  return ok({ product: serializeProduct(product) });
});

export const DELETE = handler(async (req: NextRequest, { params }: Params) => {
  const auth = await requireAuth(req, "admin");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  // Soft-delete: mark inactive. Hard-delete would break FK on OrderItem history.
  await prisma.product.update({
    where: { id },
    data: { isActive: false, stock: 0 },
  });
  return ok({ message: "Product deactivated" });
});
