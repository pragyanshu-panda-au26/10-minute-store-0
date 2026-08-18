import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handler, ok, parseJson, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { serializeBanner } from "@/lib/serializers";

export const GET = handler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const includeInactive = searchParams.get("includeInactive") === "true";
  const banners = await prisma.banner.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
  return ok({ banners: banners.map(serializeBanner) });
});

const createSchema = z.object({
  title: z.string().min(1).max(120),
  subtitle: z.string().max(300).optional(),
  badge: z.string().max(60).optional(),
  code: z.string().max(40).optional(),
  imageUrl: z.string().url(),
  linkUrl: z.string().url().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const POST = handler(async (req: NextRequest) => {
  const auth = await requireAuth(req, "admin");
  if (auth instanceof NextResponse) return auth;
  const body = await parseJson(req, createSchema);
  if (body instanceof NextResponse) return body;

  const banner = await prisma.banner.create({ data: body });
  return ok({ banner: serializeBanner(banner) }, { status: 201 });
});
