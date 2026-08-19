import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fail, handleOptions, handler, ok, parseJson, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { toPaise } from "@/lib/money";

type Params = { params: Promise<{ id: string }> };

const createSchema = z.object({
  sku: z.string().min(1).max(64).optional(),
  label: z.string().min(1).max(60),
  price: z.number().positive(),
  originalPrice: z.number().positive().optional().nullable(),
  stock: z.number().int().nonnegative().default(0),
  imageUrl: z.string().url().optional().nullable(),
  sortOrder: z.number().int().optional(),
  isDefault: z.boolean().optional(),
});

/** GET /api/products/:id/variants — list all variants for a product (public). */
export const GET = handler(async (_req: NextRequest, { params }: Params) => {
  const { id } = await params;
  const variants = await prisma.productVariant.findMany({
    where: { productId: id },
    orderBy: { sortOrder: "asc" },
  });
  return ok({ variants });
});

/** POST /api/products/:id/variants — admin creates a variant. */
export const POST = handler(async (req: NextRequest, { params }: Params) => {
  const auth = await requireAuth(req, "admin");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = await parseJson(req, createSchema);
  if (body instanceof NextResponse) return body;

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) return fail("Parent product not found", 404);

  // Optional: enforce single default variant per product
  const variant = await prisma.$transaction(async (tx) => {
    if (body.isDefault) {
      await tx.productVariant.updateMany({
        where: { productId: id },
        data: { isDefault: false },
      });
    }
    return tx.productVariant.create({
      data: {
        sku: body.sku ?? `${product.sku}-V${Date.now().toString(36).toUpperCase()}`,
        productId: id,
        label: body.label,
        price: toPaise(body.price),
        originalPrice: body.originalPrice != null ? toPaise(body.originalPrice) : null,
        stock: body.stock,
        imageUrl: body.imageUrl ?? null,
        sortOrder: body.sortOrder ?? 0,
        isDefault: body.isDefault ?? false,
      },
    });
  });
  return ok({ variant }, { status: 201 });
});

export const OPTIONS = handleOptions;
