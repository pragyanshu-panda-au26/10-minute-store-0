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
}));
