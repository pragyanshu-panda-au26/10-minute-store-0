import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { DELIVERY_FEE } from "@/lib/pricing";

export interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  category: string;
  imageUrl: string;
  /** Full gallery for the PDP carousel — always leads with imageUrl. */
  images?: string[];
  weight?: string;
  stock?: number;
  rating?: number;
  /** Number of ratings behind the average — surfaced as "(N)" on the card. */
  ratingCount?: number;
  deliveryTime?: string;
  brand?: string | null;
  isVeg?: boolean;
  variants?: ProductVariantLite[];
  // Phase C attribute fields — surfaced on the PDP as key-feature chips
  // and optional ingredients/nutrition sections. All optional; missing
  // values are hidden entirely (not rendered as empty rows).
  type?: string | null;
  shelfLife?: string | null;
  countryOfOrigin?: string | null;
  ingredients?: string | null;
  nutrition?: Record<string, string> | null;
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
  /**
   * Optional delivery-partner tip in rupees. Owned by the cart because that's
   * where the customer picks it (Blinkit-parity), read at checkout so the
   * value survives the cart→checkout navigation without a reset.
   */
  tip: number;
  setTip: (n: number) => void;
  /** `variant` overrides product.price/label if provided. */
  addItem: (product: Product, variant?: ProductVariantLite | null) => void;
  decreaseQuantity: (productId: string, variantId?: string | null) => void;
  removeItem: (productId: string, variantId?: string | null) => void;
  clearCart: () => void;
  /** Client-only fallback used by dev/offline paths. Prefer applyServerPromo. */
  applyPromoCode: (code: string) => { success: boolean; message: string };
  /**
   * Server-backed validation via /api/coupons/validate. Ensures the promo the
   * user picks is one the server will actually honor at order creation —
   * previously the client-side list included promos (e.g. WELCOME20 percent)
   * that the server order route ignored, so the customer saw a discount that
   * silently disappeared at charge time.
   */
  applyServerPromo: (code: string) => Promise<{ success: boolean; message: string }>;
  removePromoCode: () => void;
  getTotalItems: () => number;
  getTotalPrice: () => number;
  getDiscountAmount: () => number;
  /** Returns qty for a specific product+variant; falls back to base product when variantId omitted. */
  getItemQuantity: (productId: string, variantId?: string | null) => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
  items: [],
  appliedPromo: null,
  tip: 0,

  // Non-negative integer only — anything else is a UI bug on the caller's side
  // and would poison the bill math. We clamp defensively instead of trusting it.
  setTip: (n) => {
    const clean = Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
    set({ tip: clean });
  },

  addItem: (product, variant) => {
    const currentItems = get().items;
    const variantId = variant?.id ?? null;
    const key = cartLineKey(product.id, variantId);
    const existingIndex = currentItems.findIndex(
      (item) => cartLineKey(item.product.id, item.variantId) === key
    );

    // Cap quantity at whatever stock the variant/product declares — no cap
    // when the field is missing. Previously the store happily incremented
    // past stock, which then bounced at checkout with a confusing server
    // error (or oversold silently while the fallback DB was in play).
    const stockCap =
      variant && typeof variant.stock === "number"
        ? variant.stock
        : typeof product.stock === "number"
          ? product.stock
          : null;

    let updatedItems: CartItem[] = [];
    if (existingIndex > -1) {
      const existing = currentItems[existingIndex];
      if (stockCap !== null && existing.quantity >= stockCap) {
        // Nothing to do — already at max. Skip the state churn so subscribers
        // don't re-render for a no-op.
        return;
      }
      // Non-mutating update — replace the object so memoized consumers see a
      // new reference. Previously we mutated `updatedItems[i].quantity += 1`
      // on the copied array, leaving the item's object identity unchanged.
      updatedItems = currentItems.map((item, i) =>
        i === existingIndex ? { ...item, quantity: item.quantity + 1 } : item
      );
    } else {
      if (stockCap !== null && stockCap <= 0) return; // out of stock
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
    // Reset tip on cart clear — a tip attached to a now-empty cart is stale
    // and would otherwise carry into whatever the customer adds next.
    set({ items: [], appliedPromo: null, tip: 0 });
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

  applyServerPromo: async (codeStr) => {
    const cleanCode = codeStr.trim().toUpperCase();
    const subtotal = get().getTotalPrice();
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: cleanCode, subtotal }),
      });
      const data = await res.json();
      if (!data.success) {
        return { success: false, message: data.message || "Invalid promo code" };
      }
      // Build a PromoCode entry that matches what the discount helper expects.
      // The server always returns type in { flat, percent, free_shipping }.
      const promo: PromoCode = {
        code: data.code,
        type: data.type,
        // For flat coupons we store the resolved discount in rupees so the
        // cart shows the same number as the server; percent/free_shipping
        // just carry a symbolic value.
        value: data.type === "flat" ? Math.round(data.discount) : data.value ?? 0,
        minOrder: 0,
        description: data.description || "",
      };
      set({ appliedPromo: promo });
      return { success: true, message: `Coupon ${promo.code} applied.` };
    } catch (err: any) {
      // Fall back to the built-in list only if we truly can't reach the server —
      // gives the app a working offline coupon path without silently accepting
      // a coupon the server would reject.
      return get().applyPromoCode(codeStr);
    }
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
      // Credit whatever delivery fee actually applies (0 above the free-delivery
      // threshold, otherwise the current DELIVERY_FEE). Previously hardcoded
      // ₹25, which was both stale AND larger than the ₹19 the server actually
      // charged — customers got a phantom ₹6 extra off.
      return subtotal >= 199 ? 0 : DELIVERY_FEE;
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
    }),
    {
      // Persists the basket across page reloads. Previously the store lived
      // only in memory and a refresh wiped the cart — the localStorage key
      // `satyug_live_active_cart` was written for the abandoned-cart channel
      // but never rehydrated back into state.
      name: "satyug_cart_v1",
      storage: createJSONStorage(() => localStorage),
      // Only the items + applied promo need to survive a refresh. Functions
      // in the store are recreated on load, so we don't (and can't) persist
      // them.
      partialize: (state) => ({
        items: state.items,
        appliedPromo: state.appliedPromo,
        tip: state.tip,
      }),
    }
  )
);
