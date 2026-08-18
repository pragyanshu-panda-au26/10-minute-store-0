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
}

export interface CartItem {
  product: Product;
  quantity: number;
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
  addItem: (product: Product) => void;
  decreaseQuantity: (productId: string) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  applyPromoCode: (code: string) => { success: boolean; message: string };
  removePromoCode: () => void;
  getTotalItems: () => number;
  getTotalPrice: () => number;
  getDiscountAmount: () => number;
  getItemQuantity: (productId: string) => number;
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  appliedPromo: null,

  addItem: (product) => {
    const currentItems = get().items;
    const existingIndex = currentItems.findIndex(
      (item) => item.product.id === product.id
    );

    let updatedItems: CartItem[] = [];
    if (existingIndex > -1) {
      updatedItems = [...currentItems];
      updatedItems[existingIndex].quantity += 1;
    } else {
      updatedItems = [...currentItems, { product, quantity: 1 }];
    }

    set({ items: updatedItems });
    broadcastDraftCart(updatedItems);
  },

  decreaseQuantity: (productId) => {
    const currentItems = get().items;
    const existing = currentItems.find(
      (item) => item.product.id === productId
    );

    if (!existing) return;

    let updatedItems: CartItem[] = [];
    if (existing.quantity <= 1) {
      updatedItems = currentItems.filter((item) => item.product.id !== productId);
    } else {
      updatedItems = currentItems.map((item) =>
        item.product.id === productId
          ? { ...item, quantity: item.quantity - 1 }
          : item
      );
    }

    set({ items: updatedItems });
    broadcastDraftCart(updatedItems);
  },

  removeItem: (productId) => {
    const updated = get().items.filter((item) => item.product.id !== productId);
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
      (total, item) => total + item.product.price * item.quantity,
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

  getItemQuantity: (productId) => {
    const item = get().items.find((i) => i.product.id === productId);
    return item ? item.quantity : 0;
  },
}));
