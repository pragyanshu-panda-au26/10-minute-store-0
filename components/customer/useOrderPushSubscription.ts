"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * useOrderPushSubscription — one-liner React hook for enabling web-push
 * notifications about order status.
 *
 *   const push = useOrderPushSubscription();
 *   <button onClick={push.enable} disabled={!push.supported}>Enable notifications</button>
 *
 * Internals:
 *   • Registers /sw.js (only once — checks existing registrations first).
 *   • Uses the browser's PushManager to request a VAPID subscription with the
 *     `NEXT_PUBLIC_VAPID_PUBLIC_KEY` env var.
 *   • Posts the subscription to /api/push/subscribe so the server can send
 *     later. On disable, DELETEs it so the DB stays clean.
 *
 * Deliberately UI-agnostic — no components, no styling. The consumer wires
 * this into whatever toggle they like (profile settings, one-time nudge
 * after first order, etc.).
 */

type Status = "unsupported" | "denied" | "granted" | "default";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(raw);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function useOrderPushSubscription() {
  const [status, setStatus] = useState<Status>("default");
  const [busy, setBusy] = useState(false);
  const [subscribed, setSubscribed] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    setStatus(Notification.permission as Status);
    // Best-effort: if the SW is already registered and has an active
    // subscription, reflect that so the UI can show "You're subscribed".
    navigator.serviceWorker.getRegistration().then(async (reg) => {
      if (!reg) return;
      const sub = await reg.pushManager.getSubscription().catch(() => null);
      if (sub) setSubscribed(true);
    });
  }, []);

  const enable = useCallback(async () => {
    if (status === "unsupported") return false;
    setBusy(true);
    try {
      const vapidPub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPub) {
        console.warn("[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY not set");
        return false;
      }
      // Ask permission if we don't already have it. Chrome/iOS Safari will
      // silently reject the subscribe call otherwise.
      let perm = Notification.permission;
      if (perm === "default") perm = await Notification.requestPermission();
      setStatus(perm as Status);
      if (perm !== "granted") return false;

      const reg =
        (await navigator.serviceWorker.getRegistration()) ||
        (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;

      // Reuse an existing subscription if present — subscribing twice on the
      // same registration returns the same object, but this avoids the round-trip.
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPub) as BufferSource,
        });
      }
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
          userAgent: navigator.userAgent,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message ?? "Failed to save subscription");
      setSubscribed(true);
      return true;
    } catch (err) {
      console.warn("[push] enable failed:", err);
      return false;
    } finally {
      setBusy(false);
    }
  }, [status]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return true;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch(
          `/api/push/subscribe?endpoint=${encodeURIComponent(sub.endpoint)}`,
          { method: "DELETE", credentials: "include" }
        ).catch(() => null);
        await sub.unsubscribe();
      }
      setSubscribed(false);
      return true;
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    supported: status !== "unsupported",
    status,
    subscribed,
    busy,
    enable,
    disable,
  };
}
