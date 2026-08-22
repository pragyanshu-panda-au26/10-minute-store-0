import { create } from "zustand";
import { AdminOrder, OrderStatus } from "@/lib/adminDummyData";

/**
 * Server-backed order store.
 * Reads from /api/orders (Prisma), writes go through PATCH /api/orders/[id].
 * No more localStorage persistence — the DB is the source of truth.
 */

interface OrderStore {
  orders: AdminOrder[];
  loading: boolean;
  error: string | null;
  fetchOrders: () => Promise<void>;
  updateOrderStatus: (id: string, status: OrderStatus) => Promise<void>;
  setOrders: (orders: AdminOrder[]) => void;
  addLocalOrder: (order: AdminOrder) => void;
  /**
   * Open an SSE connection to /api/admin/orders/stream and merge live
   * deltas into the store. Returns a cleanup function; call it from a React
   * useEffect return. Replaces the 20 s polling loop.
   */
  subscribeAdminStream: () => () => void;
}

export const useOrderStore = create<OrderStore>((set, get) => ({
  orders: [],
  loading: false,
  error: null,

  fetchOrders: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/orders", { credentials: "include" });
      const data = await res.json();
      if (!data.success) throw new Error(data.message ?? "Failed to load orders");
      set({ orders: data.orders, loading: false });
    } catch (err: any) {
      set({ loading: false, error: err.message ?? "Failed to load orders" });
    }
  },

  updateOrderStatus: async (id, status) => {
    // optimistic
    const prev = get().orders;
    set({ orders: prev.map((o) => (o.id === id || o.orderNumber === id ? { ...o, status } : o)) });
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message ?? "Failed to update");
      set({ orders: get().orders.map((o) => (o.id === data.order.id ? data.order : o)) });
    } catch (err) {
      // rollback
      set({ orders: prev });
      throw err;
    }
  },

  setOrders: (orders) => set({ orders }),
  addLocalOrder: (order) => set({ orders: [order, ...get().orders] }),

  subscribeAdminStream: () => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      // SSR / unsupported — fall back to a plain fetch and a no-op cleanup.
      void get().fetchOrders();
      return () => {};
    }
    const src = new EventSource("/api/admin/orders/stream", { withCredentials: true });

    src.addEventListener("snapshot", (e) => {
      try {
        const { orders } = JSON.parse((e as MessageEvent).data);
        set({ orders, loading: false, error: null });
      } catch {}
    });

    src.addEventListener("update", (e) => {
      try {
        const { orders: deltas } = JSON.parse((e as MessageEvent).data) as { orders: AdminOrder[] };
        // Upsert each delta into the local list. Preserve ordering by
        // re-sorting on updatedAt / createdAt (deltas arrive newest-first
        // but the local list may have older un-updated rows behind them).
        const map = new Map(get().orders.map((o) => [o.id, o]));
        for (const d of deltas) map.set(d.id, d);
        const merged = Array.from(map.values()).sort((a, b) => {
          const at = new Date((a as any).createdAt || 0).getTime();
          const bt = new Date((b as any).createdAt || 0).getTime();
          return bt - at;
        });
        set({ orders: merged });
      } catch {}
    });

    src.addEventListener("error", () => {
      // The browser auto-reconnects on error. We only surface an error if
      // the connection can't be re-established at all.
      if (src.readyState === EventSource.CLOSED) {
        set({ error: "Live feed disconnected. Reload to reconnect." });
      }
    });

    return () => src.close();
  },
}));
