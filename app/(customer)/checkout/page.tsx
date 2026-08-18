"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { useCartStore } from "@/store/useCartStore";
import { useUserStore } from "@/store/useUserStore";
import { useOrderStore } from "@/store/useOrderStore";
import MobileBottomNav from "@/components/customer/MobileBottomNav";
import AuthModal from "@/components/customer/AuthModal";
import {
  ArrowLeft,
  QrCode,
  Banknote,
  ShieldCheck,
  CheckCircle2,
  Lock,
  ChevronRight,
  Loader2,
  AlertCircle,
} from "lucide-react";

type PaymentMethod = "razorpay" | "cod";

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function CheckoutPage() {
  const router = useRouter();
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("razorpay");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { items, getTotalItems, getTotalPrice, getDiscountAmount, clearCart, appliedPromo } =
    useCartStore();
  const { isLoggedIn, hydrating, hydrateSession, profile, getActiveAddress } = useUserStore();

  useEffect(() => {
    hydrateSession();
  }, [hydrateSession]);

  const activeAddr = getActiveAddress();
  const fullAddress = `${activeAddr.houseNo}, ${activeAddr.area}, ${activeAddr.city} - ${activeAddr.pincode}`;

  const totalItems = getTotalItems();
  const subtotal = getTotalPrice();
  const promoDiscount = getDiscountAmount();
  const deliveryFee = subtotal >= 199 || subtotal === 0 ? 0 : 19;
  const grandTotal = Math.max(0, subtotal + deliveryFee - promoDiscount);

  const openRazorpay = async (orderId: string) => {
    // 1. Ask our server to create a Razorpay order
    const orderRes = await fetch("/api/checkout/razorpay/create-order", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    });
    const orderData = await orderRes.json();
    if (!orderData.success) throw new Error(orderData.message ?? "Razorpay setup failed");

    // 2. Open Razorpay Checkout
    return new Promise<void>((resolve, reject) => {
      const rzp = new window.Razorpay({
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Satyug 10-Minute Store",
        description: `Order ${orderData.orderNumber}`,
        order_id: orderData.razorpayOrderId,
        prefill: {
          name: profile.name || "",
          contact: profile.phone.replace(/\D/g, "").slice(-10),
          email: profile.email || "",
        },
        theme: { color: "#10b981" },
        handler: async (response: any) => {
          try {
            const verifyRes = await fetch("/api/checkout/razorpay/verify", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(response),
            });
            const verifyData = await verifyRes.json();
            if (!verifyData.success) throw new Error(verifyData.message ?? "Verify failed");
            resolve();
          } catch (err) {
            reject(err);
          }
        },
        modal: {
          ondismiss: () => reject(new Error("Payment cancelled")),
        },
      });
      rzp.open();
    });
  };

  const handlePayAndPlaceOrder = async () => {
    if (!isLoggedIn || !profile.phone) {
      setIsAuthModalOpen(true);
      return;
    }
    if (items.length === 0) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Create the order in our DB (server re-computes everything from Prisma)
      const res = await fetch("/api/orders", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((it) => ({ productId: it.product.id, quantity: it.quantity })),
          deliveryAddress: fullAddress,
          lat: activeAddr.lat,
          lng: activeAddr.lng,
          couponCode: appliedPromo?.code ?? null,
          paymentMethod: selectedMethod,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message ?? "Order failed");

      const dbOrderId: string = data.order.id;
      const orderNumber: string = data.order.orderNumber || data.order.id;

      // 2. Razorpay path: open checkout + verify
      if (selectedMethod === "razorpay") {
        await openRazorpay(dbOrderId);
      }

      useOrderStore.getState().addLocalOrder(data.order);
      setConfirmedOrderId(orderNumber);
      clearCart();
    } catch (err: any) {
      setError(err.message ?? "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-32">
      {/* Razorpay Checkout script — safe to load; only used when Razorpay button clicked */}
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md px-4 py-3">
        <div className="mx-auto max-w-xl flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-emerald-700"
          >
            <ArrowLeft className="h-4 w-4" /> Basket
          </button>
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900">
            <Lock className="h-3.5 w-3.5 text-emerald-600" /> Secure Checkout
          </div>
          <div className="w-10" />
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-4 space-y-4">
        {confirmedOrderId ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center space-y-4 shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <span className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
              Order placed!
            </span>
            <h2 className="text-xl font-black text-slate-900">Satyug Express</h2>
            <p className="text-xs text-slate-500">
              Order #{" "}
              <strong className="text-slate-900 font-mono">{confirmedOrderId}</strong>
            </p>
            <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100 text-xs">
              <p className="font-bold text-emerald-700">Delivering to {activeAddr.label}</p>
              <p className="text-slate-600 mt-0.5">{fullAddress}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => router.push(`/orders/${confirmedOrderId}/track`)}
                className="flex-1 rounded-2xl bg-emerald-600 py-3 text-xs font-extrabold text-white shadow-md hover:bg-emerald-500"
              >
                Track my order
              </button>
              <button
                onClick={() => router.push("/")}
                className="flex-1 rounded-2xl bg-slate-900 py-3 text-xs font-bold text-white hover:bg-slate-800"
              >
                Continue shopping
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-2xl bg-slate-950 p-4 text-white text-center shadow-md">
              <p className="text-xs text-emerald-300 font-bold uppercase tracking-wider">
                Total payable
              </p>
              <p className="text-3xl font-black mt-0.5">₹{grandTotal}</p>
              {promoDiscount > 0 && (
                <p className="text-[11px] text-emerald-300 mt-1">
                  Applied {appliedPromo?.code}: −₹{promoDiscount}
                </p>
              )}
            </div>

            {!hydrating && !isLoggedIn && (
              <div className="flex items-center justify-between rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs font-bold text-amber-900">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-amber-600 flex-shrink-0" />
                  <span>Sign in to place your order</span>
                </div>
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-black text-white hover:bg-amber-700"
                >
                  Sign in
                </button>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-1 shadow-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Delivering to
              </h3>
              <p className="text-sm font-bold text-slate-900">{activeAddr.label}</p>
              <p className="text-xs text-slate-600">{fullAddress}</p>
            </div>

            {/* Payment options */}
            <div className="rounded-3xl border border-slate-200 bg-white p-5 space-y-3 shadow-xs">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Payment method
              </h2>

              {/* Razorpay */}
              <button
                type="button"
                onClick={() => setSelectedMethod("razorpay")}
                className={`w-full rounded-2xl border p-4 text-left transition-all ${
                  selectedMethod === "razorpay"
                    ? "border-emerald-500 bg-emerald-50/60"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                      <QrCode className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900">
                        Pay online (Razorpay)
                      </h3>
                      <p className="text-[11px] text-slate-500">UPI · Cards · NetBanking · Wallets</p>
                    </div>
                  </div>
                  <input
                    type="radio"
                    checked={selectedMethod === "razorpay"}
                    onChange={() => setSelectedMethod("razorpay")}
                    className="h-4 w-4 accent-emerald-600 pointer-events-none"
                  />
                </div>
              </button>

              {/* COD */}
              <button
                type="button"
                onClick={() => setSelectedMethod("cod")}
                className={`w-full rounded-2xl border p-4 text-left transition-all ${
                  selectedMethod === "cod"
                    ? "border-emerald-500 bg-emerald-50/60"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                      <Banknote className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900">
                        Cash on Delivery
                      </h3>
                      <p className="text-[11px] text-slate-500">Pay cash or UPI when the owner arrives</p>
                    </div>
                  </div>
                  <input
                    type="radio"
                    checked={selectedMethod === "cod"}
                    onChange={() => setSelectedMethod("cod")}
                    className="h-4 w-4 accent-emerald-600 pointer-events-none"
                  />
                </div>
              </button>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 pt-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>Payments handled by Razorpay · Payment info never touches our servers</span>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </>
        )}
      </main>

      {!confirmedOrderId && (
        <div
          className="fixed left-0 right-0 z-30 border-t border-slate-200 bg-white p-4 backdrop-blur-md"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 64px)" }}
        >
          <div className="mx-auto max-w-xl">
            <button
              onClick={handlePayAndPlaceOrder}
              disabled={isSubmitting || totalItems === 0}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 active:scale-95 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Processing…
                </>
              ) : !isLoggedIn ? (
                <>
                  Sign in to pay ₹{grandTotal}
                  <ChevronRight className="h-4 w-4" />
                </>
              ) : (
                <>
                  {selectedMethod === "cod" ? `Place COD order for ₹${grandTotal}` : `Pay ₹${grandTotal}`}
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      <MobileBottomNav />
    </div>
  );
}
