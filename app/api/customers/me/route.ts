import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handler, ok, parseJson, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { clearAuthCookie } from "@/lib/auth";

/**
 * Customer self-serve profile endpoint.
 *
 * PATCH — update own name and/or email. Read-only for everything else:
 *   phone changes go through a separate re-verification flow (a new OTP
 *   against the new number), not this route; role, tokenVersion, and
 *   isBlocked are admin-only.
 *
 * DELETE — soft-delete the account. Personally identifying fields are
 *   anonymized in place, the row itself is retained so Order.customer
 *   FKs stay valid and the customer's order history remains linked for
 *   ops / accounting / dispute handling. The phone is prefixed with a
 *   tombstone marker so the unique constraint still holds if the same
 *   person signs up again with the same number later.
 *
 * Both operations bump tokenVersion, which invalidates any outstanding
 * JWT for this customer — the client sees an immediate 401 on the next
 * request and must re-sign-in (or, for DELETE, stays signed out).
 */

const patchSchema = z.object({
  // Accept null-or-empty as "clear this field" so a customer can remove
  // their email if they want to. Length caps mirror the schema.
  name: z.string().trim().min(1).max(80).optional().nullable(),
  // Trim + lower-case before validation so " Foo@Bar.com " is stored as
  // "foo@bar.com". Nullable to allow removal.
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .max(120)
    .optional()
    .nullable()
    .or(z.literal("")),
});

export const PATCH = handler(async (req: NextRequest) => {
  const auth = await requireAuth(req, "customer");
  if (auth instanceof NextResponse) return auth;

  const body = await parseJson(req, patchSchema);
  if (body instanceof NextResponse) return body;

  // Turn `undefined` (field absent) into "leave alone", and empty-string
  // into null (explicit clear). Zod handles the shape; this normalises
  // intent before the write.
  const data: { name?: string | null; email?: string | null } = {};
  if (body.name !== undefined) data.name = body.name === "" ? null : body.name;
  if (body.email !== undefined) data.email = body.email === "" ? null : body.email;

  if (Object.keys(data).length === 0) {
    // No-op update. Return the current row so the client can still
    // resync without a separate GET.
    const current = await prisma.customer.findUnique({
      where: { id: auth.userId },
      select: { id: true, phone: true, name: true, email: true },
    });
    if (!current) {
      // Session valid but row missing — treat as gone.
      return NextResponse.json({ success: false, message: "Account not found" }, { status: 404 });
    }
    return ok({ user: { ...current, role: "customer" as const } });
  }

  const updated = await prisma.customer.update({
    where: { id: auth.userId },
    data,
    select: { id: true, phone: true, name: true, email: true },
  });
  return ok({ user: { ...updated, role: "customer" as const } });
});

export const DELETE = handler(async (req: NextRequest) => {
  const auth = await requireAuth(req, "customer");
  if (auth instanceof NextResponse) return auth;

  // Soft-delete flow: anonymize PII in place, invalidate every JWT for
  // this customer, and detach the phone so a fresh signup with the same
  // number can succeed. Order rows retain the (now anonymized) FK so
  // historical revenue and refund flows continue to work.
  const now = Date.now();
  await prisma.$transaction(async (tx) => {
    const current = await tx.customer.findUnique({
      where: { id: auth.userId },
      select: { phone: true },
    });
    if (!current) return; // idempotent — nothing to do
    // Tombstoned phone: guaranteed not to collide with any real E.164
    // number, and encodes when this soft-delete happened for audit.
    const tombstonedPhone = `_deleted_${now}_${current.phone}`.slice(0, 40);
    await tx.customer.update({
      where: { id: auth.userId },
      data: {
        name: null,
        email: null,
        phone: tombstonedPhone,
        isBlocked: true,
        tokenVersion: { increment: 1 },
      },
    });
    // Delete saved addresses — they carry more PII (house number, GPS
    // pin, landmark) than the customer row itself. Cascade delete on the
    // FK would fire too, but doing it explicitly means we can add other
    // cleanup here later (saved cards, preferences) without a schema
    // migration for cascade semantics.
    await tx.address.deleteMany({ where: { customerId: auth.userId } });
  });

  // Clear the session cookie so the client sees the delete take effect
  // immediately. Uses the shared helper so the cookie name / attributes
  // match the login route exactly.
  const res = NextResponse.json({ success: true }, { status: 200 });
  clearAuthCookie(res);
  return res;
});
