"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MobileBottomNav from "@/components/customer/MobileBottomNav";
import {
  ArrowLeft,
  Clock,
  PackageCheck,
  Truck,
  CheckCircle2,
  MapPin,
  Bell,
  X,
  Boxes,
  Loader2,
  Phone,
  Store,
} from "lucide-react";
import { AdminOrder } from "@/lib/adminDummyData";

const STEP_INDEX: Record<string, number> = {
  pending: 1,
  confirmed: 2,
  packed: 3,
  out_for_delivery: 4,
  delivered: 5,
  cancelled: 0,
};

export default function TrackOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(
    "🛎️ Your order is being prepared — you'll get a call when the owner heads out."
  );

  const fetchOrder = async () => {
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(id)}`, { credentials: "include" });
      const data = await res.json();
      if (!data.success) throw new Error(data.message ?? "Order not found");
      setOrder(data.order);
      setError(null);
    } catch (err: any) {
      setError(err.message ?? "Order not found");
    } finally {
      setLoading(false);
    }
  };

  // Poll for status changes every 15s
  useEffect(() => {
    fetchOrder();
    const interval = setInterval(fetchOrder, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const steps = [
    { label: "Placed", icon: Clock },
    { label: "Confirmed", icon: PackageCheck },
    { label: "Packed", icon: Boxes },
    { label: "On the way", icon: Truck },
    { label: "Delivered", icon: CheckCircle2 },
  ];

  const activeStep = order ? STEP_INDEX[order.status] ?? 1 : 1;

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-28">
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md px-4 py-3">
        <div className="mx-auto max-w-xl flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-black text-white">
              Order #{order?.orderNumber ?? id}
            </h1>
            {/* LIVE badge removed — we only poll status, no rider GPS. */}
          </div>
          <div className="w-10" />
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-4 space-y-5">
        {loading && (
          <div className="flex justify-center py-10 text-slate-400 text-xs">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading order…
          </div>
        )}

        {error && !loading && (
          <div className="rounded-2xl border border-rose-900 bg-rose-950/50 p-4 text-sm text-rose-300">
            {error}
          </div>
        )}

        {order && (
          <>
            {toastMessage && (
              <div className="flex items-center justify-between rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-bold text-white shadow-md">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-amber-300" />
                  <span>{toastMessage}</span>
                </div>
                <button onClick={() => setToastMessage(null)}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Timeline */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Progress
                </span>
                <span className="text-xs font-black text-emerald-400">
                  ETA: ~10 mins
                </span>
              </div>

              <div className="relative flex justify-between items-start pt-2">
                <div className="absolute left-4 right-4 top-6 h-1 bg-slate-800 -z-0" />
                <div
                  // Fill runs from the first step's centre to the current step's.
                  // The trailing `- 0px` in the old calc was leftover unfinished
                  // code that always resolved to 0 either way.
                  className="absolute left-4 top-6 h-1 bg-emerald-500 transition-all duration-500 -z-0"
                  style={{
                    width: `calc(${
                      ((Math.max(0, activeStep - 1)) / (steps.length - 1)) * 100
                    }% )`,
                  }}
                />

                {steps.map((s, idx) => {
                  const Icon = s.icon;
                  const isDone = idx + 1 <= activeStep;
                  const isCurrent = idx + 1 === activeStep;
                  return (
                    <div key={s.label} className="relative z-10 flex flex-col items-center w-1/5">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-full transition-all ${
                          isDone
                            ? "bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/40"
                            : "bg-slate-900 text-slate-500 border border-slate-800"
                        } ${isCurrent ? "ring-4 ring-emerald-500/30 scale-110" : ""}`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className={`mt-2 text-[10px] font-bold text-center ${isDone ? "text-emerald-400" : "text-slate-500"}`}>
                        {s.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Store info card (replaces rider info) */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400">
                  <Store className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white">10minute Store</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    The store owner delivers your order in person.
                  </p>
                </div>
              </div>
              {process.env.NEXT_PUBLIC_STORE_PHONE ? (
                <a
                  href={`tel:${process.env.NEXT_PUBLIC_STORE_PHONE.replace(/\s/g, "")}`}
                  className="hidden sm:flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-500"
                  aria-label="Call store"
                >
                  <Phone className="h-4 w-4" />
                </a>
              ) : null}
              {/* Previously this dialed order.customerPhone — i.e. the customer's
                  own number — which meant "Call store" actually called the caller.
                  Now it only appears when NEXT_PUBLIC_STORE_PHONE is configured. */}
            </div>

            {/* Delivery address */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Delivering to
              </span>
              <p className="text-sm text-slate-100 font-semibold flex items-start gap-2">
                <MapPin className="h-4 w-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <span>{order.deliveryAddress}</span>
              </p>
            </div>

            {/* Items summary */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {order.totalItems} items · ₹{order.totalPrice}
              </span>
              <ul className="text-xs text-slate-300 space-y-1">
                {order.items.map((it) => (
                  <li key={it.id} className="flex justify-between">
                    <span>{it.quantity}× {it.name}</span>
                    <span className="text-slate-400">₹{it.price * it.quantity}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </main>

      <MobileBottomNav />
    </div>
  );
}
