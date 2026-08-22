import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fail, getAuth, handler, ok, parseJson, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rateLimit";

/**
 * Support ticket endpoint — Prisma-backed.
 *
 *   POST /api/support   → anyone (rate-limited) submits an issue
 *   GET  /api/support   → admin-only listing
 *
 * Previously written into the file DB (`data/satyug_db.json` or in-memory on
 * serverless). Now durable in Postgres — the admin support inbox survives a
 * cold start.
 */

const bodySchema = z.object({
  message: z.string().trim().min(5, "Please describe the issue in a bit more detail.").max(2000),
});

export const POST = handler(async (req: NextRequest) => {
  const auth = await getAuth(req);

  // Unauthenticated submissions are OK for the "not signed in yet" case,
  // but it's a spam channel without a rate limit. Clamp per IP + optional user.
  const denied = enforceRateLimit(req, {
    bucket: "support:submit",
    perMinute: 3,
    perHour: 15,
    perDay: 30,
    keyExtra: auth?.userId,
  });
  if (denied) return denied;

  const body = await parseJson(req, bodySchema);
  if (body instanceof NextResponse) return body;

  const ticket = await prisma.supportTicket.create({
    data: {
      customerId: auth?.userId ?? null,
      customerPhone: auth?.phone ?? null,
      customerName: auth?.name ?? null,
      message: body.message,
      status: "open",
    },
  });

  return ok({ ticket }, { status: 201 });
});

export const GET = handler(async (req: NextRequest) => {
  const auth = await requireAuth(req, "admin");
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); // "open" | "resolved" | null (all)
  const tickets = await prisma.supportTicket.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return ok({ tickets });
});
