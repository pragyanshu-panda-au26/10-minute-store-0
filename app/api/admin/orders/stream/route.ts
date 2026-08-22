import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { serializeOrder } from "@/lib/serializers";

/**
 * GET /api/admin/orders/stream
 *
 * Server-sent events feed for the admin Kanban. Replaces the 20-second poll
 * loop in the admin dashboard — one long-lived connection instead of a
 * request every 20 s per open admin tab.
 *
 * Protocol:
 *   • On connect, emits a `snapshot` event with the last ~50 orders.
 *   • Every ~5 s, re-checks the DB. If anything has updated (createdAt or
 *     updatedAt bumped past the last poll), emits an `update` event with
 *     only the changed rows.
 *   • Emits a `heartbeat` comment every ~15 s so proxies (Vercel, Cloudflare)
 *     don't drop the connection for idle.
 *
 * Notes:
 *   • This is short-poll-over-SSE, not true DB change-stream. Postgres LISTEN
 *     / NOTIFY would be cleaner but needs a persistent connection outside
 *     Neon's pooler and adds ops overhead. 5-second poll is well under one
 *     Kanban invocation the app used to fire every 20 s.
 *   • The route runs on the Node runtime (Prisma). Vercel serverless keeps
 *     an SSE response alive up to `maxDuration` — we set 300 s (5 min) and
 *     the client reconnects automatically via EventSource.
 */

export const runtime = "nodejs";
export const maxDuration = 300; // seconds — Vercel free/pro cap on route life

const ENCODER = new TextEncoder();
const POLL_INTERVAL_MS = 5_000;
const HEARTBEAT_INTERVAL_MS = 15_000;

// Return null on auth failure — for SSE we can't emit a proper 401 mid-stream,
// so we reject the initial handshake instead.
export async function GET(req: NextRequest) {
  const auth = await getAuth(req);
  if (!auth || auth.role !== "admin") {
    return NextResponse.json(
      { success: false, message: "Admin session required" },
      { status: 401 }
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const safeEnqueue = (chunk: string) => {
        if (closed) return;
        try { controller.enqueue(ENCODER.encode(chunk)); }
        catch { closed = true; }
      };
      const send = (event: string, data: unknown) => {
        safeEnqueue(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      // Initial snapshot — same shape as GET /api/orders returns
      let lastSeenAt = new Date();
      try {
        const orders = await prisma.order.findMany({
          include: { items: true },
          orderBy: { createdAt: "desc" },
          take: 50,
        });
        send("snapshot", { orders: orders.map(serializeOrder) });
      } catch (err) {
        send("error", { message: "Initial snapshot failed" });
      }

      // Poll loop — emits delta events for orders whose updatedAt has moved
      // since the last poll, capped at 100 per tick.
      const pollTimer = setInterval(async () => {
        if (closed) return;
        try {
          const changed = await prisma.order.findMany({
            where: { updatedAt: { gt: lastSeenAt } },
            include: { items: true },
            orderBy: { updatedAt: "desc" },
            take: 100,
          });
          if (changed.length > 0) {
            send("update", { orders: changed.map(serializeOrder) });
            lastSeenAt = changed[0].updatedAt;
          }
        } catch (err) {
          send("error", { message: "Poll failed" });
        }
      }, POLL_INTERVAL_MS);

      // Heartbeat — colon-prefixed line is a comment in SSE, invisible to
      // client onmessage but keeps proxies happy.
      const heartbeatTimer = setInterval(() => {
        safeEnqueue(`: heartbeat ${Date.now()}\n\n`);
      }, HEARTBEAT_INTERVAL_MS);

      // Cleanup when the client disconnects
      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(pollTimer);
        clearInterval(heartbeatTimer);
        try { controller.close(); } catch {}
      });
    },
    cancel() { /* handled via req.signal.abort */ },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      // Nginx / some proxies buffer SSE by default; this disables it.
      "X-Accel-Buffering": "no",
    },
  });
}
