/**
 * Web-push helpers — VAPID-signed order-status notifications.
 *
 * Env config (see also .env.example):
 *   VAPID_PUBLIC_KEY   — the browser subscribes with this
 *   VAPID_PRIVATE_KEY  — server signs push payloads with this
 *   VAPID_SUBJECT      — mailto: or https:// URL identifying the sender
 *                        (Chrome enforces; use "mailto:connect@…")
 *
 * Generate a fresh key pair once with:
 *   node -e "console.log(require('web-push').generateVAPIDKeys())"
 *
 * The public key must also be exposed to the browser as
 * NEXT_PUBLIC_VAPID_PUBLIC_KEY so the service worker can subscribe.
 *
 * Every send is best-effort — if the browser has unsubscribed (410 GONE
 * from the push endpoint), we prune the row so we don't keep hammering
 * dead subscriptions on every subsequent order.
 */

import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/log";

let configured = false;
function configure() {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!pub || !priv || !subject) return false;
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string; // opened when the user clicks the notification
  tag?: string; // collapses duplicate notifications for the same order
}

export async function sendPushToCustomer(customerId: string, payload: PushPayload): Promise<void> {
  if (!configure()) {
    log.debug("Push skipped — VAPID keys not configured");
    return;
  }
  const subs = await prisma.pushSubscription
    .findMany({ where: { customerId } })
    .catch(() => []);
  if (subs.length === 0) return;

  const serialized = JSON.stringify(payload);
  const staleIds: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          serialized,
          { TTL: 60 * 60 } // 1 hour — deliver later if the browser is offline briefly
        );
        // Best-effort touch of lastUsedAt for observability. Not awaited.
        void prisma.pushSubscription
          .update({ where: { id: s.id }, data: { lastUsedAt: new Date() } })
          .catch(() => {});
      } catch (err: any) {
        // 404 / 410 = subscription expired or the user unsubscribed.
        // Prune so we don't keep trying on every future notification.
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          staleIds.push(s.id);
        } else {
          log.warn("Push send failed", { customerId, endpoint: s.endpoint }, err?.message ?? err);
        }
      }
    })
  );

  if (staleIds.length > 0) {
    await prisma.pushSubscription
      .deleteMany({ where: { id: { in: staleIds } } })
      .catch(() => {});
  }
}
