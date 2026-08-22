"use client";

import { useEffect, useRef, useState } from "react";
import type { AdminOrder } from "@/lib/adminDummyData";

/**
 * Fires an audio ding + browser notification when a new PENDING order
 * appears in a polled orders list. Zero backend deps — pure client-side.
 *
 * Usage in the admin orders page:
 *
 *   const alert = useNewOrderAlert(orders);
 *   // Somewhere in the UI, expose the enable button:
 *   {alert.needsPermission && (
 *     <button onClick={alert.requestPermission}>Enable order alerts</button>
 *   )}
 *
 * How it works:
 *   1. On mount, snapshots the current pending-order ids so historical
 *      orders don't fire the alert.
 *   2. On every subsequent `orders` update, computes the diff — for each
 *      truly new pending order it:
 *         a) plays a beep via Web Audio (no MP3 asset needed)
 *         b) fires a `Notification` if permission is granted
 *   3. Alerts are muted for the first 2 seconds after mount so
 *      hot-reload doesn't false-trigger.
 */
export function useNewOrderAlert(orders: AdminOrder[]) {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "unsupported"
  );
  const knownIdsRef = useRef<Set<string>>(new Set());
  const mountedAtRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Seed the known-set on first mount
  useEffect(() => {
    mountedAtRef.current = Date.now();
    knownIdsRef.current = new Set(
      orders.filter((o) => o.status === "pending").map((o) => o.id)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // First 2 s: swallow to avoid strict-mode / initial-fetch double fires
    if (Date.now() - mountedAtRef.current < 2000) return;

    const currentPending = orders.filter((o) => o.status === "pending");
    const brandNew = currentPending.filter((o) => !knownIdsRef.current.has(o.id));

    if (brandNew.length === 0) {
      // Keep the known set fresh (drop delivered/cancelled) so if an order
      // returns to pending later it fires again.
      knownIdsRef.current = new Set(currentPending.map((o) => o.id));
      return;
    }

    for (const order of brandNew) {
      knownIdsRef.current.add(order.id);
      beep();
      notify(order);
    }
  }, [orders]);

  const requestPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    try {
      const res = await Notification.requestPermission();
      setPermission(res);
      // Small confirmation beep so the owner knows sound works.
      beep();
    } catch (err) {
      console.warn("[alert] permission error:", err);
    }
  };

  const beep = () => {
    if (typeof window === "undefined") return;
    try {
      audioCtxRef.current ??= new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const ctx = audioCtxRef.current!;
      // Two short chirps — obvious but not annoying
      const now = ctx.currentTime;
      for (let i = 0; i < 2; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(880 + i * 220, now + i * 0.16);
        gain.gain.setValueAtTime(0.0001, now + i * 0.16);
        gain.gain.exponentialRampToValueAtTime(0.25, now + i * 0.16 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.16 + 0.14);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + i * 0.16);
        osc.stop(now + i * 0.16 + 0.15);
      }
    } catch (err) {
      // AudioContext may be blocked until user interacts — silently ignore
    }
  };

  const notify = (order: AdminOrder) => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    try {
      const n = new Notification("New order · 10minute", {
        body: `#${order.orderNumber ?? order.id} · ${order.customerName} · ₹${order.totalPrice}`,
        tag: `order-${order.id}`, // dedupes if multiple fire
        requireInteraction: false,
      });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch (err) {
      console.warn("[alert] notification error:", err);
    }
  };

  return {
    permission,
    needsPermission: permission === "default",
    unsupported: permission === "unsupported",
    granted: permission === "granted",
    requestPermission,
    /** Manually trigger a test ding (useful for the "Enable alerts" button). */
    testBeep: beep,
  };
}
