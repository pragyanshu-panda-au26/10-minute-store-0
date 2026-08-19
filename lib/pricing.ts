/**
 * Single source of truth for cart / checkout pricing on the CLIENT.
 *
 * Server truth lives in `app/api/orders/route.ts` — the constants and formula
 * here must match those values exactly, otherwise the customer sees one total
 * in the UI and is charged another. Any change here MUST also be reflected in
 * the server route.
 *
 *   delivery fee : ₹19 (waived at subtotal ≥ ₹199)
 *   handling fee : ₹2  (waived at subtotal ≥ ₹199)
 *   FREESHIP     : delivery fee waived (matches whatever the current fee is,
 *                  never a fixed rupee credit — that used to over-credit users)
 */

export const DELIVERY_FEE = 19;
export const HANDLING_FEE = 2;
export const FREE_ABOVE = 199;

export interface BillInput {
  subtotal: number;
  couponType?: "flat" | "percent" | "free_shipping" | null;
  couponValue?: number; // rupees for flat, percent for percent
  percentCap?: number; // cap for percent coupon (rupees)
  tip?: number;
}

export interface BillBreakdown {
  subtotal: number;
  deliveryFee: number;
  handlingFee: number;
  discount: number;
  tip: number;
  total: number;
}

export function computeBill({
  subtotal,
  couponType = null,
  couponValue = 0,
  percentCap = 100,
  tip = 0,
}: BillInput): BillBreakdown {
  if (subtotal <= 0) {
    return { subtotal: 0, deliveryFee: 0, handlingFee: 0, discount: 0, tip: 0, total: 0 };
  }

  const freeDelivery = subtotal >= FREE_ABOVE;
  let deliveryFee = freeDelivery ? 0 : DELIVERY_FEE;
  const handlingFee = freeDelivery ? 0 : HANDLING_FEE;

  let discount = 0;
  if (couponType === "flat") {
    discount = Math.min(couponValue, subtotal);
  } else if (couponType === "percent") {
    discount = Math.min(Math.round((subtotal * couponValue) / 100), percentCap);
  } else if (couponType === "free_shipping") {
    // Waive whatever delivery fee currently applies — no over-credit.
    discount = 0;
    deliveryFee = 0;
  }

  const total = Math.max(0, subtotal + deliveryFee + handlingFee + tip - discount);
  return { subtotal, deliveryFee, handlingFee, discount, tip, total };
}
