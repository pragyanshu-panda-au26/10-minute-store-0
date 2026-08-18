import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { serializeCategory } from "@/lib/serializers";

export const GET = handler(async (_req: NextRequest) => {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    include: { subcategories: true },
    orderBy: { sortOrder: "asc" },
  });
  // Prepend synthetic "all" category so client doesn't hardcode it.
  const all = { id: "all", name: "All Products", icon: "🛍️", sortOrder: -1, isActive: true, subcategories: ["All Items"] };
  return ok({ categories: [all, ...categories.map(serializeCategory)] });
});
