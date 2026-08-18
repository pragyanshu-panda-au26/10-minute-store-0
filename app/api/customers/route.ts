import { NextRequest, NextResponse } from "next/server";
import { handler, ok, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { serializeCustomer } from "@/lib/serializers";

/**
 * GET /api/customers  (admin only) — list all customers with order stats.
 */
export const GET = handler(async (req: NextRequest) => {
  const auth = await requireAuth(req, "admin");
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();

  const customers = await prisma.customer.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : {},
    include: { orders: { select: { total: true } }, _count: { select: { orders: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return ok({ customers: customers.map(serializeCustomer) });
});
