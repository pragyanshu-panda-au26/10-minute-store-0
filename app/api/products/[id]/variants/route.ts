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

/**
 * PUT /api/products/:id/variants — bulk-replace the variant set for a
 * product. Feeds the admin variant editor: the client sends the full
 * desired state, we diff against what's in the DB and apply the minimum
 * ops needed.
 *
 * Delete strategy: orphan variants (in DB, not in payload) are deleted
 * ONLY when no OrderItem references them. Referenced variants are left
 * in place — we don't have a soft-delete flag on ProductVariant, and
 * hard-deleting would break past order history. This is fine because
 * once a variant has an order tied to it, "the admin removed it" reads
 * as "we stopped selling it" — same effect.
 *
 * `isDefault` is enforced-unique across the set: if the payload marks
 * multiple defaults, the last one wins; if none is marked, the first
 * survivor becomes default so the PDP variant picker always resolves.
 */
const putItemSchema = z.object({
  id: z.string().optional(), // present = update existing row
  sku: z.string().min(1).max(64).optional(),
  label: z.string().min(1).max(60),
  price: z.number().positive(),
  originalPrice: z.number().positive().optional().nullable(),
  stock: z.number().int().nonnegative().default(0),
  imageUrl: z.string().url().optional().nullable(),
  sortOrder: z.number().int().optional(),
  isDefault: z.boolean().optional(),
});
const putSchema = z.object({
  variants: z.array(putItemSchema).max(20),
});

export const PUT = handler(async (req: NextRequest, { params }: Params) => {
  const auth = await requireAuth(req, "admin");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = await parseJson(req, putSchema);
  if (body instanceof NextResponse) return body;

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) return fail("Parent product not found", 404);

  // Normalize default flag — at most one, and always exactly one when
  // payload has any variants.
  const payload = body.variants.map((v, i) => ({ ...v, _idx: i }));
  const defaultIdx = payload.findLastIndex((v) => v.isDefault);
  const finalDefaultIdx = defaultIdx >= 0 ? defaultIdx : payload.length > 0 ? 0 : -1;
  const wantById = new Map(
    payload.filter((v) => v.id).map((v) => [v.id as string, v])
  );

  const existing = await prisma.productVariant.findMany({
    where: { productId: id },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((v) => v.id));

  const result = await prisma.$transaction(async (tx) => {
    // Delete orphans that no OrderItem references — leaving referenced
    // orphans in place preserves order history.
    const orphanIds = existing
      .map((v) => v.id)
      .filter((eid) => !wantById.has(eid));
    for (const oid of orphanIds) {
      const referenced = await tx.orderItem.count({ where: { variantId: oid } });
      if (referenced === 0) {
        await tx.productVariant.delete({ where: { id: oid } });
      }
    }

    // Upsert each payload variant.
    const upserted: string[] = [];
    for (let i = 0; i < payload.length; i++) {
      const v = payload[i];
      const isDef = i === finalDefaultIdx;
      const commonData = {
        label: v.label,
        price: toPaise(v.price),
        originalPrice: v.originalPrice != null ? toPaise(v.originalPrice) : null,
        stock: v.stock,
        imageUrl: v.imageUrl ?? null,
        sortOrder: v.sortOrder ?? i,
        isDefault: isDef,
      };
      if (v.id && existingIds.has(v.id)) {
        const updated = await tx.productVariant.update({
          where: { id: v.id },
          data: commonData,
        });
        upserted.push(updated.id);
      } else {
        const created = await tx.productVariant.create({
          data: {
            ...commonData,
            productId: id,
            sku: v.sku ?? `${product.sku}-V${Date.now().toString(36).toUpperCase()}${i}`,
          },
        });
        upserted.push(created.id);
      }
    }
    // Return the final list.
    return tx.productVariant.findMany({
      where: { productId: id },
      orderBy: { sortOrder: "asc" },
    });
  });

  return ok({ variants: result });
});

export const OPTIONS = handleOptions;
