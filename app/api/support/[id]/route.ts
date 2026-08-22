import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fail, handler, ok, parseJson, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  status: z.enum(["open", "resolved"]),
});

export const PATCH = handler(async (req: NextRequest, { params }: Params) => {
  const auth = await requireAuth(req, "admin");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await parseJson(req, bodySchema);
  if (body instanceof NextResponse) return body;

  try {
    const ticket = await prisma.supportTicket.update({
      where: { id },
      data: { status: body.status },
    });
    return ok({ ticket });
  } catch {
    return fail("Ticket not found", 404);
  }
});
