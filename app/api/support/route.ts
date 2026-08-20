import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fail, getAuth, handler, ok, parseJson, requireAuth } from "@/lib/api";
import { getDb, saveDb, SupportTicket } from "@/lib/db";

/**
 * Support ticket endpoint.
 *
 *   POST /api/support   → any authenticated customer submits an issue
 *   GET  /api/support   → admin-only listing of open + resolved tickets
 *
 * Persistence uses the file-DB fallback because there is no dedicated Prisma
 * table for tickets yet. On serverless hosts (Vercel prod) the file DB is
 * in-memory only — the ticket survives long enough for the admin dashboard
 * to pick it up but does not persist across cold starts. Good enough as a
 * v1 replacement for the previous "form goes nowhere" behavior.
 */

const bodySchema = z.object({
  message: z.string().trim().min(5, "Please describe the issue in a bit more detail.").max(2000),
});

export const POST = handler(async (req: NextRequest) => {
  const auth = await getAuth(req);
  const body = await parseJson(req, bodySchema);
  if (body instanceof NextResponse) return body;

  const ticket: SupportTicket = {
    id: "tkt_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    customerId: auth?.userId ?? null,
    customerPhone: auth?.phone ?? null,
    customerName: auth?.name ?? null,
    message: body.message,
    status: "open",
    createdAt: new Date().toISOString(),
  };

  const db = getDb();
  if (!db.supportTickets) db.supportTickets = [];
  db.supportTickets.unshift(ticket);
  saveDb(db);

  return ok({ ticket }, { status: 201 });
});

export const GET = handler(async (req: NextRequest) => {
  const auth = await requireAuth(req, "admin");
  if (auth instanceof NextResponse) return auth;

  const tickets = (getDb().supportTickets ?? []).slice(0, 200);
  return ok({ tickets });
});
