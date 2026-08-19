import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fail, handleOptions, handler, ok, parseJson, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/products/bulk-stock
 * Admin-only. Accepts either absolute stock levels (`stock`) or deltas (`delta`).
 * Match by `id` OR `sku` (SKU wins if both provided).
 *
 * Body:
 *   { items: [{ id?, sku?, stock?, delta? }, ...] }
 *
 * Response: { updated: N, missing: [sku|id], failed: [{sku|id, error}] }
 *
 * Also writes an InventoryTx row per successful change so the audit ledger
 * reflects reality.
 */

const itemSchema = z.object({
  id: z.string().optional(),
  sku: z.string().optional(),
  stock: z.number().int().nonnegative().optional(),
  delta: z.number().int().optional(),
  reason: z.string().max(60).optional(),
}).refine(
  (v) => (v.id || v.sku) && (v.stock !== undefined || v.delta !== undefined),
  "Each item needs id or sku, and stock or delta"
);

const bodySchema = z.object({
  items: z.array(itemSchema).min(1).max(500),
  defaultReason: z.string().max(60).optional(),
});

export const POST = handler(async (req: NextRequest) => {
  const auth = await requireAuth(req, "admin");
  if (auth instanceof NextResponse) return auth;
  const body = await parseJson(req, bodySchema);
  if (body instanceof NextResponse) return body;

  const missing: (string)[] = [];
  const failed: { key: string; error: string }[] = [];
  let updated = 0;

  for (const item of body.items) {
    const key = item.sku ?? item.id!;
    try {
      const where = item.sku ? { sku: item.sku } : { id: item.id! };
      const existing = await prisma.product.findFirst({ where });
      if (!existing) {
        missing.push(key);
        continue;
      }
      const newStock = item.stock !== undefined
        ? item.stock
        : Math.max(0, (existing.stock ?? 0) + (item.delta ?? 0));
      const delta = newStock - (existing.stock ?? 0);

      await prisma.$transaction([
        prisma.product.update({ where: { id: existing.id }, data: { stock: newStock } }),
        prisma.inventoryTx.create({
          data: {
            productId: existing.id,
            delta,
            reason: item.reason ?? body.defaultReason ?? (item.delta != null ? "restock" : "adjustment"),
          },
        }),
      ]);
      updated++;
    } catch (err: any) {
      failed.push({ key, error: err?.message ?? "unknown error" });
    }
  }

  console.log(`[bulk-stock] admin=${auth.userId} updated=${updated} missing=${missing.length} failed=${failed.length}`);
  return ok({ updated, missing, failed, requested: body.items.length });
});

export const OPTIONS = handleOptions;
