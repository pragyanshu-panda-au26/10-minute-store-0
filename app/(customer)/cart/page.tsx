"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/store/useCartStore";
import { useUserStore, formatAddress } from "@/store/useUserStore";
import { computeBill, FREE_ABOVE } from "@/lib/pricing";
import PromoCodeEngine from "@/components/customer/PromoCodeEngine";
import MobileBottomNav from "@/components/customer/MobileBottomNav";
import AddressPicker from "@/components/customer/AddressPicker";
import AddressFormModal from "@/components/customer/AddressFormModal";
import {
  ArrowLeft,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Sparkles,
  MapPin,
  ShieldCheck,
  ArrowRight,
  Heart,
  Info,
} from "lucide-react";

// Tip presets are percent-anchored to the subtotal so a small cart doesn't
// suggest a tip that reads as insulting-or-oversized. Matches the same
// formula used by CheckoutBillCard, kept here so /cart doesn't need to pull
// the entire component in just for the tip row.
const TIP_PERCENTS = [0, 3, 5, 7] as const;
function suggestTip(subtotal: number, pct: number): number {
  if (pct === 0) return 0;
  const raw = (subtotal * pct) / 100;
  const rounded = Math.round(raw / 5) * 5;
  return Math.max(5, rounded);
}

// De-duplicate the preset list — on low subtotals (₹100 range) the 3 / 5 / 7 %
// suggestions all round to ₹5 and the strip renders as `₹5 · ₹5 · ₹5`, which
// reads as broken. Keep the FIRST amount seen so the smallest percent-anchored
// preset survives, and let the shopper reach higher amounts via "Custom".
function tipPresets(subtotal: number): { label: string; amount: number }[] {
  const seen = new Set<number>();
  const out: { label: string; amount: number }[] = [];
  for (const pct of TIP_PERCENTS) {
    const amount = suggestTip(subtotal, pct);
    if (seen.has(amount)) continue;
    seen.add(amount);
    out.push({ label: pct === 0 ? "No tip" : `₹${amount}`, amount });
  }
  return out;
}

export default function CartPage() {
  const router = useRouter();
  const {
    items,
    addItem,
    decreaseQuantity,
    removeItem,
    getTotalItems,
    getTotalPrice,
    getDiscountAmount,
    appliedPromo,
    tip,
    setTip,
  } = useCartStore();

  const { getActiveAddress } = useUserStore();
  const activeAddr = getActiveAddress();
  const fullAddress = formatAddress(activeAddr);

  const totalItems = getTotalItems();
  const subtotal = getTotalPrice();

  // Address picker (existing saved addresses) + AddressFormModal (add new) —
  // both are bottom sheets so the cart stays visible behind them. Blinkit
  // uses the same pattern; the previous "Change → /profile" route lost the
  // cart context entirely on tap.
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);

  // Shared bill helper — must match the drawer, the checkout page, and the
  // server order route so the customer sees ONE consistent total everywhere.
  const deliveryThreshold = FREE_ABOVE;
  const promoDiscount = getDiscountAmount();

  // Blinkit-parity "Your total savings ₹X" pill — sum of MRP-vs-selling
  // deltas across the cart. Only counts items that actually have an
  // originalPrice; a product priced at MRP contributes nothing. Coupon +
  // free-delivery savings fold in on top so the pill reflects the shopper's
  // full win, not just the manufacturer markdown.
  const mrpSavings = items.reduce((sum, it) => {
    const mrp = it.product.originalPrice;
    const unit = it.unitPrice ?? it.product.price;
    if (!mrp || mrp <= unit) return sum;
    return sum + (mrp - unit) * it.quantity;
  }, 0);
  const deliverySavings =
    subtotal >= deliveryThreshold ? 19 : 0; // DELIVERY_FEE waived — quick match to lib/pricing.ts
  const totalSavings = mrpSavings + promoDiscount + deliverySavings;
  const bill = computeBill({
    subtotal,
    couponType: appliedPromo?.type ?? null,
    couponValue: appliedPromo?.value ?? 0,
    tip,
  });
  const deliveryFee = bill.deliveryFee;
  const handlingFee = bill.handlingFee;
  const grandTotal = bill.total;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-28">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md px-4 py-3">
        <div className="mx-auto max-w-xl flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-emerald-700"
          >
            <ArrowLeft className="h-4 w-4" /> Store
          </button>
          <h1 className="text-base font-black text-slate-900">
            Review Basket ({totalItems})
          </h1>
          <div className="w-10" />
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-xl px-4 py-4 space-y-4">
        {/* Delivery Address Banner */}
        <div className="flex items-center justify-between rounded-2xl bg-white p-3.5 border border-slate-200 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">
                Delivery to {activeAddr.label} (~10 Mins)
              </p>
              <p className="text-[11px] text-slate-500 line-clamp-1">{fullAddress}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsPickerOpen(true)}
            className="text-xs font-bold text-emerald-600 hover:underline cursor-pointer"
          >
            Change
          </button>
        </div>

        {/* Total-savings pill — mirrors Blinkit's "Your total savings ₹231"
            accent that lives right under the header. Only renders when we
            actually saved the shopper money; a naked "₹0 saved" pill would
            just take up space. */}
        {totalSavings > 0 && items.length > 0 && (
          <div className="flex items-center justify-between rounded-2xl bg-emerald-600 px-4 py-3 text-white shadow-md">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-100" />
              <span className="text-xs font-black uppercase tracking-wide">
                Your total savings
              </span>
            </div>
            <span className="text-base font-black tabular-nums">
              ₹{totalSavings}
            </span>
          </div>
        )}

        {/* Free Delivery Unlock Meter */}
        <div className="rounded-2xl bg-emerald-50 p-3 border border-emerald-100 text-xs">
          {subtotal >= deliveryThreshold ? (
            <div className="flex items-center gap-2 font-bold text-emerald-800">
              <Sparkles className="h-4 w-4 text-emerald-600" />
              Yay! You unlocked <strong>FREE Delivery</strong>
            </div>
          ) : (
            <div className="text-emerald-900">
              Add <strong className="text-emerald-700">₹{deliveryThreshold - subtotal}</strong> more for <strong>FREE Delivery</strong>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-emerald-200">
                <div
                  className="h-full bg-emerald-600 transition-all duration-300"
                  style={{ width: `${(subtotal / deliveryThreshold) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Items List */}
        <div className="rounded-3xl border border-slate-200 bg-white p-4 space-y-3 shadow-xs">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Basket Items
          </h2>

          {items.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <ShoppingBag className="mx-auto h-12 w-12 text-slate-300 mb-2" />
              <p className="font-bold text-sm">Your basket is empty</p>
              <Link
                href="/"
                className="mt-3 inline-block rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-500"
              >
                Start Shopping
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {items.map(({ product, quantity }) => (
                <div key={product.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="relative h-14 w-14 overflow-hidden rounded-xl border border-slate-100 bg-slate-50 flex-shrink-0">
                      <Image
                        src={product.imageUrl}
                        alt={product.name}
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 line-clamp-1">
                        {product.name}
                      </h4>
                      <p className="text-[11px] text-slate-400">{product.weight}</p>
                      <p className="mt-0.5 text-xs font-black text-slate-900">
                        ₹{product.price * quantity}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
                      <button
                        onClick={() => decreaseQuantity(product.id)}
                        className="p-1 text-slate-600 hover:text-slate-900 rounded"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center text-xs font-black">
                        {quantity}
                      </span>
                      <button
                        onClick={() => addItem(product)}
                        className="p-1 text-slate-600 hover:text-slate-900 rounded"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    <button
                      onClick={() => removeItem(product.id)}
                      className="p-1 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Promo Code Engine Section */}
        {items.length > 0 && <PromoCodeEngine />}

        {/* Tip your delivery partner — Blinkit-parity, lives on /cart so the
            checkout page doesn't ask again. Persists to useCartStore so it
            travels to /checkout unchanged. */}
        {items.length > 0 && (
          <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-600 flex-shrink-0">
                <Heart className="h-4 w-4 fill-current" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black text-slate-900">
                  Tip your delivery partner
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  100 % goes to the person delivering your order.
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {tipPresets(subtotal).map(({ label, amount }) => {
                    const active = tip === amount;
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setTip(amount)}
                        className={`rounded-full border px-3 py-1 text-xs font-black transition-all cursor-pointer ${
                          active
                            ? "border-rose-600 bg-rose-600 text-white shadow"
                            : "border-rose-200 bg-white text-rose-700 hover:border-rose-300"
                        }`}
                        title={amount === 0 ? "No tip" : `Tip of ₹${amount}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                  {/* Custom — lets the shopper pick any amount, escape hatch
                      for when the presets don't hit the mark. Prompt is
                      intentionally simple; a modal would be over-designed
                      for a single-number ask. */}
                  <button
                    type="button"
                    onClick={() => {
                      const presetAmounts = tipPresets(subtotal).map((p) => p.amount);
                      const raw = window.prompt(
                        "Enter tip amount in ₹ (0 to remove)",
                        String(!presetAmounts.includes(tip) && tip > 0 ? tip : "")
                      );
                      if (raw === null) return; // user cancelled
                      const n = Math.max(0, Math.round(Number(raw) || 0));
                      setTip(n);
                    }}
                    className={`rounded-full border px-3 py-1 text-xs font-black transition-all cursor-pointer ${
                      // Highlight when the current tip isn't any of the presets
                      tip > 0 && !tipPresets(subtotal).some((p) => p.amount === tip)
                        ? "border-rose-600 bg-rose-600 text-white shadow"
                        : "border-rose-200 bg-white text-rose-700 hover:border-rose-300"
                    }`}
                  >
                    {tip > 0 && !tipPresets(subtotal).some((p) => p.amount === tip)
                      ? `₹${tip}`
                      : "Custom"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bill Details */}
        {items.length > 0 && (
          <div className="rounded-3xl border border-slate-200 bg-white p-5 space-y-3 shadow-xs">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Bill Breakdown
            </h2>

            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Items Subtotal</span>
                <span className="font-semibold text-slate-900">₹{subtotal}</span>
              </div>
              <div className="flex justify-between">
                <span>Delivery Charge</span>
                {deliveryFee === 0 ? (
                  <span className="font-bold text-emerald-600">FREE</span>
                ) : (
                  <span className="font-semibold text-slate-900">₹{deliveryFee}</span>
                )}
              </div>
              <div className="flex justify-between">
                <span>Handling Fee</span>
                <span className="font-semibold text-slate-900">₹{handlingFee}</span>
              </div>

              {promoDiscount > 0 && (
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>Applied Promo Coupon</span>
                  <span>-₹{promoDiscount}</span>
                </div>
              )}

              {tip > 0 && (
                <div className="flex justify-between">
                  <span>Tip for delivery partner</span>
                  <span className="font-semibold text-slate-900">₹{tip}</span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 flex justify-between text-base font-black text-slate-900">
                <span>Total Amount Payable</span>
                <span className="text-emerald-700">₹{grandTotal}</span>
              </div>
            </div>
          </div>
        )}

        {/* Cancellation policy — inline blurb, matches Blinkit copy pattern.
            One paragraph, no accordion, no "read more" so support gets
            fewer "why can't I cancel?" tickets. */}
        {items.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 flex gap-3 shadow-xs">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600 flex-shrink-0">
              <Info className="h-4 w-4" />
            </div>
            <div className="text-[11px] text-slate-600 leading-relaxed">
              <p className="text-xs font-black text-slate-900 mb-0.5">
                Cancellation Policy
              </p>
              Orders cannot be cancelled once packed for delivery. In case of
              unexpected delays, a refund will be provided, if applicable.
            </div>
          </div>
        )}
      </main>

      {/* Mobile CTA Bar */}
      {items.length > 0 && (
        <div className="fixed bottom-16 md:bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white p-4 backdrop-blur-md">
          <div className="mx-auto max-w-xl">
            <Link
              href="/checkout"
              className="flex w-full items-center justify-between rounded-2xl bg-emerald-600 px-6 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 active:scale-95 transition-all"
            >
              <span>Proceed to Checkout</span>
              <div className="flex items-center gap-1.5">
                <span>₹{grandTotal}</span>
                <ArrowRight className="h-4 w-4" />
              </div>
            </Link>
          </div>
        </div>
      )}

      <MobileBottomNav />

      {/* Address bottom-sheets — the picker lists saved addresses; the form
          modal is the "+ Add new" path if the customer has none, or picks
          "Add new" from the picker itself. Same components /checkout uses. */}
      <AddressPicker
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onAddNew={() => {
          setIsPickerOpen(false);
          setIsAddressModalOpen(true);
        }}
      />

      <AddressFormModal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        onSaved={() => setIsAddressModalOpen(false)}
      />
    </div>
  );
}
