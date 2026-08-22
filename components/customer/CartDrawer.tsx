"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/store/useCartStore";
import { useUserStore, formatAddress } from "@/store/useUserStore";
import { computeBill, FREE_ABOVE } from "@/lib/pricing";
import AuthModal from "@/components/customer/AuthModal";
import { useAbandonedCartTracker } from "@/components/customer/useAbandonedCartTracker";
import {
  ShoppingBag,
  X,
  Plus,
  Minus,
  ChevronRight,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Loader2,
  MapPin,
  Lock,
} from "lucide-react";

export default function CartDrawer() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const isSubmitting = false;
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Abandoned-cart telemetry — a lingering-in-the-drawer shopper is the
  // biggest recoverable segment, so record the snapshot from here.
  useAbandonedCartTracker({ step: "Basket Drawer" });

  const {
    items,
    addItem,
    decreaseQuantity,
    getTotalItems,
    getTotalPrice,
    getDiscountAmount,
    appliedPromo,
  } = useCartStore();

  const { isLoggedIn, profile, getActiveAddress } = useUserStore();
  const activeAddr = getActiveAddress();
  const fullDeliveryAddress = formatAddress(activeAddr);

  const totalItems = getTotalItems();
  const subtotal = getTotalPrice();

  // Shared bill helper — same math as the checkout page AND the server route
  // so the number in this drawer matches what the customer is finally charged.
  const bill = computeBill({
    subtotal,
    couponType: appliedPromo?.type ?? null,
    couponValue: appliedPromo?.value ?? 0,
  });
  const deliveryThreshold = FREE_ABOVE;
  const deliveryFee = bill.deliveryFee;
  const handlingFee = bill.handlingFee;
  const promoDiscount = getDiscountAmount();
  const grandTotal = bill.total;

  if (totalItems === 0) return null;

  // Route the user to /checkout for the real Razorpay/COD flow.
  const handleCheckout = () => {
    if (!isLoggedIn || !profile.phone) {
      setIsAuthModalOpen(true);
      return;
    }
    setIsOpen(false);
    router.push("/checkout");
  };


  return (
    <>
      {/* Floating Checkout Strip Fixed at Bottom */}
      {totalItems > 0 && !isOpen && (
        <div className="fixed bottom-16 sm:bottom-4 left-4 right-4 z-40 mx-auto max-w-xl animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="flex items-center justify-between rounded-2xl bg-slate-950/95 px-4 py-3 text-white shadow-2xl backdrop-blur-xl border border-slate-800">
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-slate-950 font-black">
                <ShoppingBag className="h-5 w-5" />
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[10px] font-black text-slate-900 shadow">
                  {totalItems}
                </span>
              </div>
              <div>
                <p className="text-xs font-semibold text-emerald-200">
                  {totalItems} {totalItems === 1 ? "item" : "items"} added
                </p>
                <p className="text-base font-extrabold text-white">
                  ₹{grandTotal}{" "}
                  <span className="text-[11px] font-normal text-slate-300">
                    (incl. taxes)
                  </span>
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-slate-950 transition-all hover:bg-emerald-400 active:scale-95 cursor-pointer shadow-md shadow-emerald-500/20"
            >
              View Cart
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Slide-over Cart Drawer / Sheet */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity animate-in fade-in"
            onClick={() => !isSubmitting && setIsOpen(false)}
          />

          {/* Drawer Panel */}
          <div className="relative z-10 flex h-full w-full max-w-md flex-col bg-white shadow-2xl animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <ShoppingBag className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Your Basket
                  </h2>
                  <p className="text-xs text-slate-500">
                    Express Delivery in <span className="font-bold text-emerald-600">10 mins</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                disabled={isSubmitting}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 active:scale-90"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Selected Delivery Address Banner */}
            <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-100/60 px-5 py-2.5 text-xs">
              <MapPin className="h-4 w-4 text-emerald-600 flex-shrink-0" />
              <div className="truncate">
                <span className="font-bold text-slate-900">
                  Delivering to {activeAddr.label}:
                </span>{" "}
                <span className="text-slate-600 font-medium">{fullDeliveryAddress}</span>
              </div>
            </div>

            {/* Delivery Progress Bar */}
            <div className="bg-emerald-50/80 px-5 py-2.5 border-b border-emerald-100/60">
              {subtotal >= deliveryThreshold ? (
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
                  <Sparkles className="h-4 w-4 text-emerald-600" />
                  <span>Yay! You unlocked <strong>FREE Delivery</strong></span>
                </div>
              ) : (
                <div className="text-xs text-emerald-900">
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

            {/* Itemized Cart List */}
            <div className="flex-1 overflow-y-auto p-5 divide-y divide-slate-100">
              {items.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center text-center">
                  <div className="mb-3 text-4xl">🛒</div>
                  <p className="font-semibold text-slate-700">Your basket is empty</p>
                  <p className="text-xs text-slate-400 mt-1">Add items to get instant 10-min delivery</p>
                </div>
              ) : (
                items.map(({ product, quantity }) => (
                  <div key={product.id} className="flex items-center justify-between py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="relative h-14 w-14 overflow-hidden rounded-xl border border-slate-100 bg-slate-50 flex-shrink-0">
                        <Image
                          src={product.imageUrl}
                          alt={product.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 line-clamp-1">
                          {product.name}
                        </h4>
                        <p className="text-[11px] text-slate-500">{product.weight}</p>
                        <p className="mt-1 text-xs font-extrabold text-slate-900">
                          ₹{product.price * quantity}{" "}
                          <span className="text-[10px] font-normal text-slate-400">
                            (₹{product.price} each)
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-1">
                      <button
                        onClick={() => decreaseQuantity(product.id)}
                        disabled={isSubmitting}
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded active:scale-90"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-6 text-center text-xs font-bold text-slate-900">
                        {quantity}
                      </span>
                      <button
                        onClick={() => addItem(product)}
                        disabled={isSubmitting}
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded active:scale-90"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Bill Summary Footer */}
            {items.length > 0 && (
              <div className="border-t border-slate-100 bg-slate-50 p-5 space-y-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Bill Details
                </h3>

                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span>Items Subtotal</span>
                    <span className="font-semibold text-slate-800">₹{subtotal}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Delivery Charge</span>
                    {deliveryFee === 0 ? (
                      <span className="font-bold text-emerald-600">FREE</span>
                    ) : (
                      <span className="font-semibold text-slate-800">₹{deliveryFee}</span>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span>Handling Charge</span>
                    <span className="font-semibold text-slate-800">₹{handlingFee}</span>
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-black text-slate-900">
                    <span>To Pay</span>
                    <span className="text-emerald-700">₹{grandTotal}</span>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 pt-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  <span>100% Quality & Express 10-Minute Delivery</span>
                </div>

                {/* Login Status Banner if not signed in */}
                {!isLoggedIn && (
                  <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200/80 p-2.5 text-xs font-bold text-amber-800">
                    <Lock className="h-4 w-4 text-amber-600 flex-shrink-0" />
                    <span>Please Sign In via Mobile OTP before completing order.</span>
                  </div>
                )}

                {/* Checkout CTA */}
                <button
                  onClick={handleCheckout}
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 active:scale-[0.99] transition-all disabled:opacity-75 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                      Placing Order...
                    </>
                  ) : !isLoggedIn ? (
                    <>
                      Sign In to Place Order • ₹{grandTotal}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      Proceed to Checkout • ₹{grandTotal}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Auth Modal Triggered when Guest user attempts checkout */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={() => {
          setIsAuthModalOpen(false);
          handleCheckout();
        }}
      />

    </>
  );
}
