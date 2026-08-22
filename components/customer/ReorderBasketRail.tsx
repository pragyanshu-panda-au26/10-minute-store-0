"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { RotateCcw, ArrowRight, Loader2 } from "lucide-react";
import { useUserStore } from "@/store/useUserStore";
import { useCartStore } from "@/store/useCartStore";
import { useProductStore } from "@/store/useProductStore";

/**
 * ReorderBasketRail — the highest-conversion single element on the entire
 * home page for returning customers.
 *
 * Shows the customer's most recent order as a one-tap "add all again" card,
 * pinned above the category grid. Hidden entirely when:
 *   • the customer isn't signed in (nothing to reorder)
 *   • they have items in their cart (already mid-flow — don't hijack it)
 *   • they haven't ordered before, or their last order was cancelled
 *   • the fetch is still in flight (no flash of empty)
 *
 * Fetches from GET /api/orders, takes the newest non-cancelled row, and
 * hydrates via useProductStore so the "add all" button can put fresh
 * product objects into the cart — not stale snapshots off the order.
 */

interface OrderItemSnap {
  productId?: string;
  id?: string;
  name: string;
  imageUrl?: string;
  price?: number;
  quantity: number;
  variantId?: string | null;
}

interface RecentOrder {
  id: string;
  orderNumber?: string;
  status: string;
  createdAt: string;
  totalPrice?: number;
  total?: number;
  items: OrderItemSnap[];
}

export default function ReorderBasketRail() {
  const router = useRouter();
  const { isLoggedIn } = useUserStore();
  const { items: cartItems, addItem } = useCartStore();
  const { products, fetchProducts } = useProductStore();

  const [order, setOrder] = useState<RecentOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [reordering, setReordering] = useState(false);

  // Only fetch when signed in AND cart is empty — otherwise the rail is
  // hidden anyway and we shouldn't waste an API call.
  useEffect(() => {
    if (!isLoggedIn || cartItems.length > 0) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/orders?limit=5", { credentials: "include" });
        const data = await res.json();
        if (cancelled) return;
        if (!data.success) {
          setOrder(null);
          return;
        }
        const eligible = (data.orders as RecentOrder[]).find(
          (o) => o.status !== "cancelled" && Array.isArray(o.items) && o.items.length > 0
        );
        setOrder(eligible ?? null);
      } catch {
        if (!cancelled) setOrder(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, cartItems.length]);

  const handleReorderAll = async () => {
    if (!order || reordering) return;
    setReordering(true);
    try {
      // Make sure the product catalog is loaded — otherwise addItem would
      // insert stale snapshot data (and worse, stock caps wouldn't work).
      if (products.length === 0) {
        await fetchProducts();
      }
      // Read the freshest catalog directly from the store, not the closure —
      // the state may have updated during the await above.
      const productMap = new Map(
        useProductStore.getState().products.map((p) => [p.id, p as any])
      );
      let added = 0;
      const skipped: string[] = [];
      for (const item of order.items) {
        const productId = item.productId ?? item.id;
        if (!productId) continue;
        const live = productMap.get(productId);
        if (!live || (live.stock ?? 0) <= 0) {
          skipped.push(item.name);
          continue;
        }
        const variant = item.variantId
          ? live.variants?.find((v: any) => v.id === item.variantId)
          : null;
        const times = Math.max(0, Math.floor(item.quantity || 0));
        for (let i = 0; i < times; i++) {
          addItem(live, variant ?? null);
        }
        added += times;
      }
      if (added === 0) {
        // Nothing to add — bail rather than navigating to an empty cart.
        alert(
          skipped.length > 0
            ? "None of the items from your last order are in stock right now."
            : "Couldn't rebuild your last basket."
        );
        return;
      }
      router.push("/cart");
    } finally {
      setReordering(false);
    }
  };

  // Guard rails — see file-level comment
  if (!isLoggedIn) return null;
  if (cartItems.length > 0) return null;
  if (loading) return null;
  if (!order) return null;

  const total = order.total ?? order.totalPrice ?? 0;
  const uniqueItems = order.items.slice(0, 4);
  const overflow = Math.max(0, order.items.length - uniqueItems.length);

  return (
    <div className="mx-auto max-w-7xl px-4 pt-3 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 dark:border-emerald-800 dark:bg-emerald-950/30 p-3 sm:p-4">
        {/* Product thumb stack */}
        <div className="flex -space-x-2 flex-shrink-0">
          {uniqueItems.map((item, idx) => (
            <div
              key={item.productId ?? item.id ?? idx}
              className="relative h-11 w-11 rounded-xl border-2 border-white dark:border-slate-900 bg-white dark:bg-slate-800 overflow-hidden shadow-sm"
              style={{ zIndex: 10 - idx }}
            >
              {item.imageUrl ? (
                <Image
                  src={item.imageUrl}
                  alt={item.name}
                  fill
                  sizes="44px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-lg">🛒</div>
              )}
            </div>
          ))}
          {overflow > 0 && (
            <div
              className="relative flex h-11 w-11 items-center justify-center rounded-xl border-2 border-white dark:border-slate-900 bg-emerald-100 dark:bg-emerald-900/60 text-[10px] font-black text-emerald-800 dark:text-emerald-300 shadow-sm"
              style={{ zIndex: 0 }}
            >
              +{overflow}
            </div>
          )}
        </div>

        {/* Copy */}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            Reorder your last basket
          </p>
          <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
            {order.items.length} item{order.items.length === 1 ? "" : "s"} · ₹{total}
          </p>
        </div>

        {/* CTA */}
        <button
          onClick={handleReorderAll}
          disabled={reordering}
          className="flex-shrink-0 flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 sm:px-4 sm:py-2.5 text-xs font-black text-white shadow-md hover:bg-emerald-500 active:scale-95 disabled:opacity-60"
        >
          {reordering ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Adding…
            </>
          ) : (
            <>
              <RotateCcw className="h-3.5 w-3.5" />
              Reorder
              <ArrowRight className="h-3.5 w-3.5 -mr-0.5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
