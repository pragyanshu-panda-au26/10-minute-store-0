import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handler, ok, parseJson, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { serializeAddress } from "@/lib/serializers";

export const GET = handler(async (req: NextRequest) => {
  const auth = await requireAuth(req, "customer");
  if (auth instanceof NextResponse) return auth;

  const addresses = await prisma.address.findMany({
    where: { customerId: auth.userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
  return ok({ addresses: addresses.map(serializeAddress) });
});

const createSchema = z.object({
  label: z.string().min(1).max(30),
  houseNo: z.string().min(1).max(200),
  area: z.string().min(1).max(200),
  city: z.string().min(1).max(120),
  pincode: z.string().min(4).max(10),
  lat: z.number().optional(),
  lng: z.number().optional(),
  landmark: z.string().max(200).optional(),
  contactName: z.string().max(80).optional(),
  contactPhone: z.string().max(20).optional(),
  isDefault: z.boolean().optional(),
});

export const POST = handler(async (req: NextRequest) => {
  const auth = await requireAuth(req, "customer");
  if (auth instanceof NextResponse) return auth;
  const body = await parseJson(req, createSchema);
  if (body instanceof NextResponse) return body;

  const address = await prisma.$transaction(async (tx) => {
    if (body.isDefault) {
      await tx.address.updateMany({
        where: { customerId: auth.userId },
        data: { isDefault: false },
      });
    }
    return tx.address.create({ data: { ...body, customerId: auth.userId } });
  });
  return ok({ address: serializeAddress(address) }, { status: 201 });
});
