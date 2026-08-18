import { NextRequest } from "next/server";
import { fail, getAuth, handler, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const GET = handler(async (req: NextRequest) => {
  const payload = await getAuth(req);
  if (!payload) return fail("Not authenticated", 401);

  if (payload.role === "admin") {
    const admin = await prisma.admin.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, name: true },
    });
    if (!admin) return fail("Admin session invalid", 401);
    return ok({
      user: { id: admin.id, email: admin.email, name: admin.name, role: "admin" as const },
    });
  }

  const customer = await prisma.customer.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      phone: true,
      name: true,
      email: true,
      addresses: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!customer) return fail("Customer session invalid", 401);

  return ok({
    user: {
      id: customer.id,
      phone: customer.phone,
      name: customer.name,
      email: customer.email,
      role: "customer" as const,
      addresses: customer.addresses,
    },
  });
});
