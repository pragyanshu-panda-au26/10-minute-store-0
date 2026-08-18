import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fail, handler, ok, parseJson, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { toPaise } from "@/lib/money";
import { serializeProduct } from "@/lib/serializers";

export const GET = handler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const query = searchParams.get("q");
  const storeId = searchParams.get("store_id");
  const includeInactive = searchParams.get("includeInactive") === "true";

  const products = await prisma.product.findMany({
    where: {
      ...(includeInactive ? {} : { isActive: true }),
      ...(category && category !== "all" ? { categoryId: category } : {}),
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { tags: { has: query.toLowerCase() } },
            ],
          }
        : {}),
    },
    include: {
      subcategory: true,
      variants: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });

  return ok({ store_id: storeId || "STORE_PARADIP_MAIN", products: products.map(serializeProduct) });
});

const createSchema = z.object({
  sku: z.string().min(1).max(64).optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  category: z.string().min(1), // categoryId slug
  subcategoryId: z.string().optional().nullable(),
  price: z.number().positive(),
  originalPrice: z.number().positive().optional(),
  costPrice: z.number().nonnegative().optional(),
  stock: z.number().int().nonnegative(),
  weight: z.string().min(1).max(60),
  imageUrl: z.string().url(),
  rating: z.number().min(0).max(5).optional(),
  tags: z.array(z.string()).optional(),
});

export const POST = handler(async (req: NextRequest) => {
  const auth = await requireAuth(req, "admin");
  if (auth instanceof NextResponse) return auth;

  const body = await parseJson(req, createSchema);
  if (body instanceof NextResponse) return body;

  // Verify category exists
  const cat = await prisma.category.findUnique({ where: { id: body.category } });
  if (!cat) return fail(`Unknown category: ${body.category}`, 400);

  const product = await prisma.product.create({
    data: {
      sku: body.sku ?? `SKU-${Date.now().toString(36).toUpperCase()}`,
      name: body.name,
      description: body.description,
      categoryId: body.category,
      subcategoryId: body.subcategoryId ?? null,
      price: toPaise(body.price),
      originalPrice: body.originalPrice ? toPaise(body.originalPrice) : null,
      costPrice: body.costPrice ? toPaise(body.costPrice) : null,
      stock: body.stock,
      weight: body.weight,
      imageUrl: body.imageUrl,
      rating: body.rating ?? 4.5,
      tags: body.tags ?? [],
    },
    include: { subcategory: true },
  });
  return ok({ product: serializeProduct(product) }, { status: 201 });
});
