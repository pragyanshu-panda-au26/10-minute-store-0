import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fail, handler, ok, parseJson, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { serializeAddress } from "@/lib/serializers";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  label: z.string().min(1).max(30).optional(),
  houseNo: z.string().min(1).max(200).optional(),
  area: z.string().min(1).max(200).optional(),
  city: z.string().min(1).max(120).optional(),
  pincode: z.string().min(4).max(10).optional(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  landmark: z.string().max(200).optional().nullable(),
  contactName: z.string().max(80).optional().nullable(),
  contactPhone: z.string().max(20).optional().nullable(),
  isDefault: z.boolean().optional(),
});

export const PATCH = handler(async (req: NextRequest, { params }: Params) => {
  const auth = await requireAuth(req, "customer");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = await parseJson(req, patchSchema);
  if (body instanceof NextResponse) return body;

  const existing = await prisma.address.findUnique({ where: { id } });
  if (!existing || existing.customerId !== auth.userId) return fail("Not found", 404);

  const address = await prisma.$transaction(async (tx) => {
    if (body.isDefault) {
      await tx.address.updateMany({
        where: { customerId: auth.userId },
        data: { isDefault: false },
      });
    }
    return tx.address.update({ where: { id }, data: body });
  });
  return ok({ address: serializeAddress(address) });
});

export const DELETE = handler(async (req: NextRequest, { params }: Params) => {
  const auth = await requireAuth(req, "customer");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const existing = await prisma.address.findUnique({ where: { id } });
  if (!existing || existing.customerId !== auth.userId) return fail("Not found", 404);
  await prisma.address.delete({ where: { id } });
  return ok({ message: "Address deleted" });
});
