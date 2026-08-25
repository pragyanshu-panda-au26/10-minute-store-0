import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
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
  brand: z.string().max(80).nullable().optional(),
  category: z.string().optional(),
  subcategoryId: z.string().nullable().optional(),
  price: z.number().positive().optional(),
  originalPrice: z.number().positive().nullable().optional(),
  costPrice: z.number().nonnegative().nullable().optional(),
  stock: z.number().int().nonnegative().optional(),
  weight: z.string().min(1).max(60).optional(),
  imageUrl: z.string().url().optional(),
  images: z.array(z.string().url()).max(9).optional(),
  rating: z.number().min(0).max(5).optional(),
  ratingCount: z.number().int().nonnegative().optional(),
  tags: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  // Phase C attribute fields — same shape + rules as the create schema.
  type: z.string().max(120).nullable().optional(),
  shelfLife: z.string().max(120).nullable().optional(),
  countryOfOrigin: z.string().max(80).nullable().optional(),
  ingredients: z.string().max(4000).nullable().optional(),
  nutrition: z.record(z.string(), z.string()).nullable().optional(),
});

export const PATCH = handler(async (req: NextRequest, { params }: Params) => {
  const auth = await requireAuth(req, "admin");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await parseJson(req, patchSchema);
  if (body instanceof NextResponse) return body;

  // Assemble the update payload as an UncheckedUpdateInput so foreign-key
  // scalars (categoryId, subcategoryId) can be set directly. The
  // conditional-spread pattern below confuses Prisma 7's union type
  // (Update vs UncheckedUpdate); typing the object up-front pins it.
  const data: Prisma.ProductUncheckedUpdateInput = {
    ...(body.name !== undefined ? { name: body.name } : {}),
    ...(body.description !== undefined ? { description: body.description } : {}),
    ...(body.brand !== undefined ? { brand: body.brand } : {}),
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
    ...(body.images !== undefined ? { images: body.images } : {}),
    ...(body.rating !== undefined ? { rating: body.rating } : {}),
    ...(body.ratingCount !== undefined ? { ratingCount: body.ratingCount } : {}),
    ...(body.tags !== undefined ? { tags: body.tags } : {}),
    ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    ...(body.type !== undefined ? { type: body.type } : {}),
    ...(body.shelfLife !== undefined ? { shelfLife: body.shelfLife } : {}),
    ...(body.countryOfOrigin !== undefined ? { countryOfOrigin: body.countryOfOrigin } : {}),
    ...(body.ingredients !== undefined ? { ingredients: body.ingredients } : {}),
    // Same empty-object-to-DbNull coercion as POST so the PDP hides the
    // nutrition block instead of rendering an empty table. Nullable JSON
    // columns need Prisma.DbNull (SQL NULL) — a bare `null` is rejected
    // at the type level and would be ambiguous with a JSON `null` literal.
    ...(body.nutrition !== undefined
      ? {
          nutrition:
            body.nutrition && Object.keys(body.nutrition).length > 0
              ? body.nutrition
              : Prisma.DbNull,
        }
      : {}),
  };

  const product = await prisma.product.update({
    where: { id },
    data,
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
