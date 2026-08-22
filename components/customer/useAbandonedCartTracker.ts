"use client";

import { useEffect, useRef } from "react";
import { useCartStore } from "@/store/useCartStore";
import { useUserStore } from "@/store/useUserStore";

/**
 * Persists a cart snapshot to /api/abandoned-carts as the shopper lingers.
 *
 * The design goal is one meaningful row per shopper per session, not one row
 * per checkbox tick:
 *   • Debounced writes (30 s idle) so a burst of add/remove clicks collapses
 *     into a single POST.
 *   • Idle threshold — nothing posts until the cart has at least one item
 *     AND the shopper has done nothing for 30 s. Two-second decisions from
 *     an engaged shopper aren't abandonment.
 *   • Best-effort flush on tab-hide / beforeunload using `navigator.sendBeacon`,
 *     which survives the browser tearing the page down.
 *   • Rate-limit on the server catches anything the client misses.
 *
 * The step is passed in by the mount point — `cart-drawer` when opened, etc.
 * A bare mount on the storefront root defaults to "Basket Drawer" since the
 * only way to have items at all is via the cart flow.
 */

type Step = "Basket Drawer" | "Delivery Address Selection" | "Payment Gateway";

interface Options {
  step?: Step;
  idleMs?: number;
}

const DEFAULT_IDLE_MS = 30_000;

export function useAbandonedCartTracker(opts: Options = {}) {
  const step: Step = opts.step ?? "Basket Drawer";
  const idleMs = opts.idleMs ?? DEFAULT_IDLE_MS;

  const items = useCartStore((s) => s.items);
  const profile = useUserStore((s) => s.profile);

  // Track the last posted snapshot to avoid re-sending an identical cart.
  const lastKey = useRef<string>("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Pointer to the current cart used by the unload flush — refs, so the
  // listener doesn't need to be re-attached on every cart change.
  const latest = useRef({ items, step, profile });
  latest.current = { items, step, profile };

  const build = () => {
    const list = latest.current.items;
    if (!list || list.length === 0) return null;
    return {
      items: list.map((it) => ({
        productId: it.product.id,
        variantId: it.variantId ?? null,
        name: it.product.name,
        weight: it.variantLabel ?? it.product.weight ?? null,
        imageUrl: it.product.imageUrl ?? null,
        priceRupees: it.unitPrice ?? it.product.price,
        quantity: it.quantity,
      })),
      lastActiveStep: latest.current.step,
      phone: latest.current.profile.phone ?? null,
      email: latest.current.profile.email ?? null,
      name: latest.current.profile.name ?? null,
    };
  };

  const flush = (viaBeacon = false) => {
    const payload = build();
    if (!payload) return;
    const key = JSON.stringify(payload);
    if (key === lastKey.current) return;
    lastKey.current = key;

    try {
      if (viaBeacon && typeof navigator !== "undefined" && "sendBeacon" in navigator) {
        const blob = new Blob([key], { type: "application/json" });
        navigator.sendBeacon("/api/abandoned-carts", blob);
        return;
      }
      // fetch keepalive lets a normal fetch survive the page unloading —
      // fallback when sendBeacon isn't around (rare, but Safari edge cases).
      fetch("/api/abandoned-carts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: key,
        keepalive: true,
      }).catch(() => {
        // Best-effort — server's rate limiter will scrub anything spammy.
      });
    } catch {
      // never let this throw into the render tree
    }
  };

  // Debounced write on cart / step change. Empty cart cancels a pending write
  // so a shopper who clears their cart doesn't get flagged as abandoned.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (items.length === 0) return;
    timer.current = setTimeout(() => flush(false), idleMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, step, idleMs]);

  // Flush on tab hide / navigation. `visibilitychange` fires on iOS Safari
  // where `beforeunload` doesn't. Both firing means we might double-post the
  // same snapshot — the last-key dedupe upstairs prevents the second write.
  useEffect(() => {
    const onHide = () => flush(true);
    const onBeforeUnload = () => flush(true);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Nothing rendered — the hook is a side-effect installer.
}
