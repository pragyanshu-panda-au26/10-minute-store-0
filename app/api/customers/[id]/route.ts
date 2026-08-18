import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handler, ok, parseJson, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { serializeCustomer } from "@/lib/serializers";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  isBlocked: z.boolean().optional(),
  name: z.string().max(80).optional(),
  email: z.string().email().max(120).optional(),
});

export const PATCH = handler(async (req: NextRequest, { params }: Params) => {
  const auth = await requireAuth(req, "admin");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = await parseJson(req, patchSchema);
  if (body instanceof NextResponse) return body;

  const customer = await prisma.customer.update({
    where: { id },
    data: body,
    include: { orders: { select: { total: true } }, _count: { select: { orders: true } } },
  });
  return ok({ customer: serializeCustomer(customer) });
});
