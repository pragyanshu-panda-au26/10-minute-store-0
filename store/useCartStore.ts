import { create } from "zustand";

export interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  category: string;
  imageUrl: string;
  weight?: string;
  stock?: number;
  rating?: number;
  deliveryTime?: string;
  brand?: string | null;
  isVeg?: boolean;
  variants?: ProductVariantLite[];
}

/** Lightweight variant shape carried in the cart / catalog. */
export interface ProductVariantLite {
  id: string;
  label: string;
  price: number;
  originalPrice?: number | null;
  stock: number;
  imageUrl?: string | null;
  isDefault?: boolean;
}

export interface CartItem {
  product: Product;
  variantId?: string | null; // null = base product (no explicit variant)
  variantLabel?: string; // snapshot for display (survives catalog updates)
  unitPrice: number; // resolved price at time of add — variant.price or product.price
  quantity: number;
}

/** Stable key so `500g Amul` and `1L Amul` are different lines in the cart. */
export function cartLineKey(productId: string, variantId?: string | null): string {
  return variantId ? `${productId}::${variantId}` : productId;
}

export interface PromoCode {
  code: string;
  type: "flat" | "free_shipping" | "percent";
  value: number;
  minOrder: number;
  description: string;
}

export const AVAILABLE_PROMOS: PromoCode[] = [
  {
    code: "SATYUG50",
    type: "flat",
    value: 50,
    minOrder: 199,
    description: "Flat ₹50 OFF on orders above ₹199",
  },
  {
    code: "FREESHIP",
    type: "free_shipping",
    value: 25,
    minOrder: 99,
    description: "100% Free Delivery on your order",
  },
  {
    code: "WELCOME20",
    type: "percent",
    value: 20,
    minOrder: 149,
    description: "20% OFF up to ₹100 for new users",
  },
];

// BroadcastChannel helper for Live Abandoned Cart Sync across tabs & Admin Dashboard
const broadcastDraftCart = (items: CartItem[]) => {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("satyug_live_active_cart", JSON.stringify(items));
      const channel = new BroadcastChannel("satyug_abandoned_carts_channel");
      channel.postMessage({
        type: "DRAFT_CART_UPDATE",
        items,
        timestamp: Date.now(),
      });
    } catch (e) {
      console.warn("BroadcastChannel error:", e);
    }
  }
};

interface CartStore {
  items: CartItem[];
  appliedPromo: PromoCode | null;
  /** `variant` overrides product.price/label if provided. */
  addItem: (product: Product, variant?: ProductVariantLite | null) => void;
  decreaseQuantity: (productId: string, variantId?: string | null) => void;
  removeItem: (productId: string, variantId?: string | null) => void;
  clearCart: () => void;
  applyPromoCode: (code: string) => { success: boolean; message: string };
  removePromoCode: () => void;
  getTotalItems: () => number;
  getTotalPrice: () => number;
  getDiscountAmount: () => number;
  /** Returns qty for a specific product+variant; falls back to base product when variantId omitted. */
  getItemQuantity: (productId: string, variantId?: string | null) => number;
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  appliedPromo: null,

  addItem: (product, variant) => {
    const currentItems = get().items;
    const variantId = variant?.id ?? null;
    const key = cartLineKey(product.id, variantId);
    const existingIndex = currentItems.findIndex(
      (item) => cartLineKey(item.product.id, item.variantId) === key
    );

    let updatedItems: CartItem[] = [];
    if (existingIndex > -1) {
      updatedItems = [...currentItems];
      updatedItems[existingIndex].quantity += 1;
    } else {
      updatedItems = [
        ...currentItems,
        {
          product,
          variantId,
          variantLabel: variant?.label ?? product.weight,
          unitPrice: variant?.price ?? product.price,
          quantity: 1,
        },
      ];
    }

    set({ items: updatedItems });
    broadcastDraftCart(updatedItems);
  },

  decreaseQuantity: (productId, variantId) => {
    const currentItems = get().items;
    const key = cartLineKey(productId, variantId ?? null);
    const existing = currentItems.find(
      (item) => cartLineKey(item.product.id, item.variantId) === key
    );
    if (!existing) return;

    let updatedItems: CartItem[] = [];
    if (existing.quantity <= 1) {
      updatedItems = currentItems.filter(
        (item) => cartLineKey(item.product.id, item.variantId) !== key
      );
    } else {
      updatedItems = currentItems.map((item) =>
        cartLineKey(item.product.id, item.variantId) === key
          ? { ...item, quantity: item.quantity - 1 }
          : item
      );
    }

    set({ items: updatedItems });
    broadcastDraftCart(updatedItems);
  },

  removeItem: (productId, variantId) => {
    const key = cartLineKey(productId, variantId ?? null);
    const updated = get().items.filter(
      (item) => cartLineKey(item.product.id, item.variantId) !== key
    );
    set({ items: updated });
    broadcastDraftCart(updated);
  },

  clearCart: () => {
    set({ items: [], appliedPromo: null });
    broadcastDraftCart([]);
  },

  applyPromoCode: (codeStr) => {
    const cleanCode = codeStr.trim().toUpperCase();
    const promo = AVAILABLE_PROMOS.find((p) => p.code === cleanCode);
    const subtotal = get().getTotalPrice();

    if (!promo) {
      return { success: false, message: "Invalid promo code" };
    }

    if (subtotal < promo.minOrder) {
      return {
        success: false,
        message: `Add items worth ₹${promo.minOrder - subtotal} more to use ${promo.code}`,
      };
    }

    set({ appliedPromo: promo });
    return { success: true, message: `Coupon ${promo.code} applied successfully!` };
  },

  removePromoCode: () => set({ appliedPromo: null }),

  getTotalItems: () =>
    get().items.reduce((total, item) => total + item.quantity, 0),

  getTotalPrice: () =>
    get().items.reduce(
      (total, item) => total + (item.unitPrice ?? item.product.price) * item.quantity,
      0
    ),

  getDiscountAmount: () => {
    const promo = get().appliedPromo;
    const subtotal = get().getTotalPrice();
    if (!promo) return 0;

    if (promo.type === "flat") {
      return promo.value;
    }
    if (promo.type === "percent") {
      const calc = (subtotal * promo.value) / 100;
      return Math.min(calc, 100);
    }
    if (promo.type === "free_shipping") {
      return 25; // Delivery fee credit
    }
    return 0;
  },

  getItemQuantity: (productId, variantId) => {
    // When variantId is omitted, sum qty across ALL variants of the product —
    // useful for "in cart" badges on category tiles where a specific variant
    // isn't relevant.
    if (variantId === undefined) {
      return get().items
        .filter((i) => i.product.id === productId)
        .reduce((sum, i) => sum + i.quantity, 0);
    }
    const key = cartLineKey(productId, variantId);
    const item = get().items.find(
      (i) => cartLineKey(i.product.id, i.variantId) === key
    );
    return item ? item.quantity : 0;
  },
}));
