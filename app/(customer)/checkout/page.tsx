"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { useCartStore } from "@/store/useCartStore";
import { useUserStore, formatAddress } from "@/store/useUserStore";
import { useOrderStore } from "@/store/useOrderStore";
import MobileBottomNav from "@/components/customer/MobileBottomNav";
import AuthModal from "@/components/customer/AuthModal";
import AddressFormModal from "@/components/customer/AddressFormModal";
import AddressPicker from "@/components/customer/AddressPicker";
import DeliverySlotPicker from "@/components/customer/DeliverySlotPicker";
import CheckoutBillCard from "@/components/customer/CheckoutBillCard";
import { CheckoutSkeleton } from "@/components/customer/Skeleton";
import { computeBill } from "@/lib/pricing";
import { useOrderPushSubscription } from "@/components/customer/useOrderPushSubscription";
import OrderPlacedCelebration from "@/components/customer/OrderPlacedCelebration";
import { useAbandonedCartTracker } from "@/components/customer/useAbandonedCartTracker";
import {
  ArrowLeft,
  QrCode,
  Banknote,
  ShieldCheck,
  Lock,
  ChevronRight,
  Loader2,
  AlertCircle,
  Bell,
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
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [tip, setTip] = useState(0);
  const [deliveryNotes, setDeliveryNotes] = useState("");
  // null = deliver now / instant; ISO string = scheduled slot start
  const [scheduledFor, setScheduledFor] = useState<string | null>(null);

  // Abandoned-cart step depends on whether the shopper is looking at the
  // address block or the payment block. Simple heuristic: no payment kicked
  // off yet ⇒ delivery step; once the button is pressed the tracker's cart
  // is emptied on success anyway.
  useAbandonedCartTracker({
    step: isSubmitting ? "Payment Gateway" : "Delivery Address Selection",
  });

  const { items, getTotalItems, getTotalPrice, getDiscountAmount, clearCart, appliedPromo } =
    useCartStore();
  const { isLoggedIn, hydrating, hydrateSession, profile, getActiveAddress } = useUserStore();
  // Peak-end moment for the notification ask — post-order success is when
  // the customer most wants to hear about their delivery. Hook is safe to
  // call even before the success screen renders; the toggle only appears
  // if push is supported and they haven't already opted in.
  const push = useOrderPushSubscription();

  useEffect(() => {
    hydrateSession();
  }, [hydrateSession]);

  const activeAddr = getActiveAddress();
  const fullAddress = formatAddress(activeAddr);
  // A real address needs the minimum three fields the order API validates.
  // Empty placeholder / GUEST fallback fails this check, so the Pay button
  // stays disabled and the address card renders the "Add address" prompt.
  const hasRealAddress = Boolean(
    activeAddr.houseNo && activeAddr.area && activeAddr.city
  );

  const totalItems = getTotalItems();
  const subtotal = getTotalPrice();
  const promoDiscount = getDiscountAmount();
  // Shared bill helper — same math as the drawer, cart page and server route.
  const bill = computeBill({
    subtotal,
    couponType: appliedPromo?.type ?? null,
    couponValue: appliedPromo?.value ?? 0,
    tip,
  });
  const deliveryFee = bill.deliveryFee;
  const handlingFee = bill.handlingFee;
  const grandTotal = bill.total;

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
        name: "10minute Store",
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
    // Force an address before we let the customer pay — the empty placeholder
    // would otherwise POST an incomplete deliveryAddress to /api/orders.
    if (!hasRealAddress) {
      setIsAddressModalOpen(true);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    // Tracked so we can cancel the DB order if the Razorpay flow fails or is
    // dismissed by the user, instead of leaving a pending unpaid order behind.
    let createdOrderId: string | null = null;
    // Idempotency key — one stable id per Place Order tap. If the browser
    // retries (double-tap, brief network glitch and the button becomes
    // clickable again, back-and-forward navigation), the server resolves
    // repeat POSTs to the same order row instead of creating duplicates.
    // Regenerated on every fresh tap so a follow-up attempt after a real
    // failure still creates a new order.
    const idempotencyKey =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `chk_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    try {
      // 1. Create the order in our DB (server re-computes everything from Prisma)
      const res = await fetch("/api/orders", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          items: items.map((it) => ({
            productId: it.product.id,
            variantId: it.variantId ?? null,
            quantity: it.quantity,
          })),
          deliveryAddress: fullAddress,
          lat: activeAddr.lat,
          lng: activeAddr.lng,
          couponCode: appliedPromo?.code ?? null,
          paymentMethod: selectedMethod,
          tip,
          notes: deliveryNotes || undefined,
          scheduledFor: scheduledFor || undefined,
          idempotencyKey,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message ?? "Order failed");

      const dbOrderId: string = data.order.id;
      const orderNumber: string = data.order.orderNumber || data.order.id;
      createdOrderId = dbOrderId;

      // 2. Razorpay path: open checkout + verify
      if (selectedMethod === "razorpay") {
        await openRazorpay(dbOrderId);
      }

      useOrderStore.getState().addLocalOrder(data.order);
      setConfirmedOrderId(orderNumber);
      clearCart();
    } catch (err: any) {
      setError(err.message ?? "Something went wrong");

      // If we already created the DB order but the Razorpay flow failed /
      // was dismissed, cancel it so it doesn't linger as a pending unpaid
      // order in the customer's history. Best-effort — swallow the failure.
      if (createdOrderId && selectedMethod === "razorpay") {
        try {
          await fetch(`/api/orders/${encodeURIComponent(createdOrderId)}`, {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "cancelled" }),
          });
        } catch {}
      }
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
        {hydrating && !confirmedOrderId ? (
          // Session rehydrate — show the same shape the customer is about
          // to see rather than a bare spinner.
          <CheckoutSkeleton />
        ) : confirmedOrderId ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center space-y-4 shadow-sm">
            {/* Peak-end moment. Confetti + live ETA countdown replace the
                static green tick — this is the emotional apex of the whole
                purchase and the visual customers remember later. Respects
                prefers-reduced-motion; fires a subtle haptic on supported
                mobile devices. */}
            <OrderPlacedCelebration active={true} etaMinutes={10} />
            <span className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
              Order placed!
            </span>
            <h2 className="text-xl font-black text-slate-900">10minute Express</h2>
            <p className="text-xs text-slate-500">
              Order #{" "}
              <strong className="text-slate-900 font-mono">{confirmedOrderId}</strong>
            </p>
            <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100 text-xs">
              <p className="font-bold text-emerald-700">Delivering to {activeAddr.label}</p>
              <p className="text-slate-600 mt-0.5">{fullAddress}</p>
            </div>

            {/* Peak-end nudge for web-push. Shown only when the browser
                supports it AND the customer hasn't already opted in AND the
                permission hasn't been hard-denied. Dismisses itself on tap
                (subscribed state flips) — no persistent "remind me later"
                to keep the confirmation screen from getting noisy. */}
            {push.supported && !push.subscribed && push.status !== "denied" && (
              <button
                onClick={() => push.enable()}
                disabled={push.busy}
                className="w-full flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3 text-left hover:bg-emerald-50 disabled:opacity-60"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 flex-shrink-0">
                    {push.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-emerald-900 leading-tight">
                      Get a ping when it&rsquo;s on the way
                    </p>
                    <p className="text-[11px] text-emerald-800/80 leading-tight mt-0.5 truncate">
                      Turn on notifications for status updates.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-black text-emerald-700 flex-shrink-0">
                  Turn on
                </span>
              </button>
            )}
            {push.subscribed && (
              <p className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                <Bell className="h-3 w-3" />
                Notifications on — we&rsquo;ll tell you the moment it moves.
              </p>
            )}

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

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Delivering to
                </h3>
                {hasRealAddress && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsPickerOpen(true)}
                      className="text-[11px] font-black text-emerald-700 hover:text-emerald-800"
                    >
                      Change
                    </button>
                    <span className="text-slate-300">·</span>
                    <button
                      type="button"
                      onClick={() => setIsAddressModalOpen(true)}
                      className="text-[11px] font-black text-emerald-700 hover:text-emerald-800"
                    >
                      + Add new
                    </button>
                  </div>
                )}
              </div>

              {hasRealAddress ? (
                <>
                  <p className="mt-1 text-sm font-bold text-slate-900">{activeAddr.label}</p>
                  <p className="text-xs text-slate-600">{fullAddress}</p>
                  {activeAddr.landmark && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      <span className="font-semibold">Landmark:</span> {activeAddr.landmark}
                    </p>
                  )}
                  {activeAddr.contactPhone && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      Contact: {activeAddr.contactName || "—"} ·{" "}
                      <a href={`tel:${activeAddr.contactPhone}`} className="text-emerald-700 font-semibold">
                        {activeAddr.contactPhone}
                      </a>
                    </p>
                  )}
                </>
              ) : (
                <div className="mt-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
                  <p className="text-xs text-slate-600">No delivery address on file yet.</p>
                  <button
                    type="button"
                    onClick={() => setIsAddressModalOpen(true)}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-emerald-500"
                  >
                    + Add delivery address
                  </button>
                </div>
              )}
            </div>

            {/* Slot picker (self-hides if the store hasn't enabled slots) */}
            <DeliverySlotPicker
              value={scheduledFor}
              onChange={setScheduledFor}
              instantEta="10 min"
            />

            {/* Blinkit-style: tip + delivery instructions + bill breakdown */}
            <CheckoutBillCard
              bill={{
                subtotal,
                deliveryFee,
                handlingFee,
                discount: promoDiscount,
                couponCode: appliedPromo?.code ?? null,
              }}
              tip={tip}
              onTipChange={setTip}
              notes={deliveryNotes}
              onNotesChange={setDeliveryNotes}
            />

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
              ) : !hasRealAddress ? (
                <>
                  Add delivery address
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

      <AddressFormModal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        onSaved={(addr) => {
          // freshly-saved address is auto-set active by useUserStore.addAddress
          setIsAddressModalOpen(false);
        }}
      />

      <AddressPicker
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onAddNew={() => {
          setIsPickerOpen(false);
          setIsAddressModalOpen(true);
        }}
      />

      <MobileBottomNav />
    </div>
  );
}
