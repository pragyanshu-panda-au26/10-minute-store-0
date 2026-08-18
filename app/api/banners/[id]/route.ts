import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handler, ok, parseJson, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { serializeBanner } from "@/lib/serializers";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  subtitle: z.string().max(300).optional(),
  badge: z.string().max(60).optional(),
  code: z.string().max(40).optional(),
  imageUrl: z.string().url().optional(),
  linkUrl: z.string().url().optional().nullable(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const PATCH = handler(async (req: NextRequest, { params }: Params) => {
  const auth = await requireAuth(req, "admin");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = await parseJson(req, patchSchema);
  if (body instanceof NextResponse) return body;
  const banner = await prisma.banner.update({ where: { id }, data: body });
  return ok({ banner: serializeBanner(banner) });
});

export const DELETE = handler(async (req: NextRequest, { params }: Params) => {
  const auth = await requireAuth(req, "admin");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  await prisma.banner.delete({ where: { id } });
  return ok({ message: "Banner deleted" });
});
