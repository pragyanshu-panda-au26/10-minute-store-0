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
  brand: z.string().max(80).optional().nullable(),
  category: z.string().min(1), // categoryId slug
  subcategoryId: z.string().optional().nullable(),
  price: z.number().positive(),
  originalPrice: z.number().positive().optional(),
  costPrice: z.number().nonnegative().optional(),
  stock: z.number().int().nonnegative(),
  weight: z.string().min(1).max(60),
  imageUrl: z.string().url(),
  // Additional image URLs for the PDP carousel — 0..9 extras beyond imageUrl.
  images: z.array(z.string().url()).max(9).optional(),
  rating: z.number().min(0).max(5).optional(),
  ratingCount: z.number().int().nonnegative().optional(),
  tags: z.array(z.string()).optional(),
  // Phase C attribute fields — all optional / nullable. `nutrition` is a
  // flat string→string map (energy, protein, carbs, etc.) so units survive
  // (e.g. "215 kcal", "4.2 g"). Server validates keys are strings; UI
  // decides which subset to show.
  type: z.string().max(120).optional().nullable(),
  shelfLife: z.string().max(120).optional().nullable(),
  countryOfOrigin: z.string().max(80).optional().nullable(),
  ingredients: z.string().max(4000).optional().nullable(),
  nutrition: z.record(z.string(), z.string()).optional().nullable(),
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
      brand: body.brand ?? null,
      categoryId: body.category,
      subcategoryId: body.subcategoryId ?? null,
      price: toPaise(body.price),
      originalPrice: body.originalPrice ? toPaise(body.originalPrice) : null,
      costPrice: body.costPrice ? toPaise(body.costPrice) : null,
      stock: body.stock,
      weight: body.weight,
      imageUrl: body.imageUrl,
      images: body.images ?? [],
      rating: body.rating ?? 4.5,
      ratingCount: body.ratingCount ?? 0,
      tags: body.tags ?? [],
      type: body.type ?? null,
      shelfLife: body.shelfLife ?? null,
      countryOfOrigin: body.countryOfOrigin ?? "India",
      ingredients: body.ingredients ?? null,
      // Empty-object nutrition writes as null so the PDP hides the section.
      nutrition:
        body.nutrition && Object.keys(body.nutrition).length > 0
          ? body.nutrition
          : null,
    },
    include: { subcategory: true },
  });
  return ok({ product: serializeProduct(product) }, { status: 201 });
});
