import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fail, handler, ok, parseJson, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/push/subscribe
 * Body: { endpoint, keys: { p256dh, auth }, userAgent? }
 *
 * Called from the browser after the customer accepts the notification
 * permission prompt. Stores the subscription against their customer id
 * so `lib/push.ts` can fan out order-status notifications later.
 *
 * DELETE /api/push/subscribe?endpoint=<encoded>
 * Removes a subscription — the customer opted out or unsubscribed.
 */

const bodySchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  userAgent: z.string().max(400).optional(),
});

export const POST = handler(async (req: NextRequest) => {
  const auth = await requireAuth(req, "customer");
  if (auth instanceof NextResponse) return auth;

  const body = await parseJson(req, bodySchema);
  if (body instanceof NextResponse) return body;

  // Upsert on endpoint so re-subscribing (same browser, cleared cache) just
  // refreshes keys instead of piling up duplicate rows.
  const sub = await prisma.pushSubscription.upsert({
    where: { endpoint: body.endpoint },
    update: {
      customerId: auth.userId,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      userAgent: body.userAgent ?? null,
      lastUsedAt: new Date(),
    },
    create: {
      customerId: auth.userId,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      userAgent: body.userAgent ?? null,
    },
  });

  return ok({ subscription: { id: sub.id } }, { status: 201 });
});

export const DELETE = handler(async (req: NextRequest) => {
  const auth = await requireAuth(req, "customer");
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const endpoint = searchParams.get("endpoint");
  if (!endpoint) return fail("Missing endpoint", 400);

  // Scope delete to the caller's own subscriptions — a customer must not
  // be able to unsubscribe someone else's device.
  await prisma.pushSubscription
    .deleteMany({ where: { endpoint, customerId: auth.userId } })
    .catch(() => {});

  return ok({ message: "Unsubscribed" });
});
