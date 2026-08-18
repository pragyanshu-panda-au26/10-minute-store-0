import { create } from "zustand";
import { Product } from "@/store/useCartStore";

/**
 * Server-backed product catalog.
 * Reads from /api/products (Prisma). Admin writes hit /api/products + /api/products/[id].
 * The customer storefront calls `fetchProducts()` on mount; the cart uses the
 * price snapshot in the cart itself so a price change mid-cart doesn't silently
 * change what the user sees.
 */

export interface ExtendedProduct extends Product {
  sku?: string;
  description?: string;
  subcategory?: string | null;
  subcategoryId?: string | null;
  // API returns nulls; local stock also allows null
  costPrice?: number | null;
  tags?: string[];
  isActive?: boolean;
}

interface ProductStore {
  products: ExtendedProduct[];
  loading: boolean;
  error: string | null;
  fetchProducts: (opts?: { includeInactive?: boolean; storeId?: string }) => Promise<void>;
  createProduct: (input: Partial<ExtendedProduct> & { name: string; price: number; category: string; stock: number; weight: string; imageUrl: string }) => Promise<ExtendedProduct | null>;
  updateProduct: (id: string, updates: Partial<ExtendedProduct>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  updateStock: (id: string, newStock: number) => Promise<void>;
  setProducts: (products: ExtendedProduct[]) => void;
}

export const useProductStore = create<ProductStore>((set, get) => ({
  products: [],
  loading: false,
  error: null,

  fetchProducts: async (opts) => {
    set({ loading: true, error: null });
    try {
      const url = new URL("/api/products", window.location.origin);
      if (opts?.includeInactive) url.searchParams.set("includeInactive", "true");
      if (opts?.storeId) url.searchParams.set("store_id", opts.storeId);
      const res = await fetch(url.toString(), { credentials: "include" });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      set({ products: data.products, loading: false });
    } catch (err: any) {
      set({ loading: false, error: err.message ?? "Failed to load products" });
    }
  },

  createProduct: async (input) => {
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    set({ products: [data.product, ...get().products] });
    return data.product;
  },

  updateProduct: async (id, updates) => {
    // optimistic
    const prev = get().products;
    set({ products: prev.map((p) => (p.id === id ? { ...p, ...updates } : p)) });
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      set({ products: get().products.map((p) => (p.id === id ? data.product : p)) });
    } catch (err) {
      set({ products: prev });
      throw err;
    }
  },

  deleteProduct: async (id) => {
    const prev = get().products;
    set({ products: prev.filter((p) => p.id !== id) });
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
    } catch (err) {
      set({ products: prev });
      throw err;
    }
  },

  updateStock: async (id, newStock) => {
    return get().updateProduct(id, { stock: newStock });
  },

  setProducts: (products) => set({ products }),
}));
