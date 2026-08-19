import { NextRequest, NextResponse } from "next/server";
import { fail, handleOptions, handler, ok, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { serializeOrder } from "@/lib/serializers";

/**
 * POST /api/orders/:id/mark-paid
 * Admin-only. COD reconciliation — after handing the order to the customer
 * and collecting cash, the owner taps "Cash received" to flip
 * paymentStatus from `pending` → `paid`. Idempotent.
 */

type Params = { params: Promise<{ id: string }> };

export const POST = handler(async (req: NextRequest, { params }: Params) => {
  const auth = await requireAuth(req, "admin");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const order = await prisma.order.findFirst({
    where: { OR: [{ id }, { orderNumber: id }] },
    include: { items: true },
  });
  if (!order) return fail("Order not found", 404);

  if (order.paymentMethod !== "cod") {
    return fail("Only COD orders can be marked paid manually", 400);
  }
  if (order.paymentStatus === "paid") {
    // Idempotent — already paid, just return the order
    return ok({ order: serializeOrder(order), alreadyPaid: true });
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { paymentStatus: "paid" },
    include: { items: true },
  });

  console.log(`[mark-paid] order=${updated.orderNumber} admin=${auth.userId}`);
  return ok({ order: serializeOrder(updated) });
});

export const OPTIONS = handleOptions;
