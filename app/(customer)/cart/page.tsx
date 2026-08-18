"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/store/useCartStore";
import { useUserStore } from "@/store/useUserStore";
import PromoCodeEngine from "@/components/customer/PromoCodeEngine";
import MobileBottomNav from "@/components/customer/MobileBottomNav";
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
} from "lucide-react";

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
  } = useCartStore();

  const { getActiveAddress } = useUserStore();
  const activeAddr = getActiveAddress();
  const fullAddress = `${activeAddr.houseNo}, ${activeAddr.area}, ${activeAddr.city} - ${activeAddr.pincode}`;

  const totalItems = getTotalItems();
  const subtotal = getTotalPrice();

  const deliveryThreshold = 199;
  const promoDiscount = getDiscountAmount();
  const deliveryFee =
    subtotal >= deliveryThreshold || subtotal === 0 || appliedPromo?.type === "free_shipping"
      ? 0
      : 25;
  const handlingFee = subtotal > 0 ? 5 : 0;
  const grandTotal = Math.max(0, subtotal + deliveryFee + handlingFee - promoDiscount);

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
          <Link
            href="/profile"
            className="text-xs font-bold text-emerald-600 hover:underline"
          >
            Change
          </Link>
        </div>

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

              <div className="pt-3 border-t border-slate-200 flex justify-between text-base font-black text-slate-900">
                <span>Total Amount Payable</span>
                <span className="text-emerald-700">₹{grandTotal}</span>
              </div>
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
    </div>
  );
}
