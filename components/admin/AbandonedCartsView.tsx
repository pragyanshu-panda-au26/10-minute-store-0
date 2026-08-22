"use client";

import { useState, useEffect } from "react";
import { AbandonedCart, INITIAL_ABANDONED_CARTS, AdminOrderItem } from "@/lib/adminDummyData";
import { useUserStore } from "@/store/useUserStore";
import { CartItem } from "@/store/useCartStore";
import {
  ShoppingBag,
  Send,
  Trash2,
  Phone,
  Mail,
  Clock,
  CheckCircle2,
  AlertCircle,
  Zap,
  DollarSign,
  MessageSquare,
  Radio,
} from "lucide-react";

export default function AbandonedCartsView() {
  const [carts, setCarts] = useState<AbandonedCart[]>(INITIAL_ABANDONED_CARTS);
  const [selectedCart, setSelectedCart] = useState<AbandonedCart | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [livePulse, setLivePulse] = useState(false);

  const { profile } = useUserStore();

  // Subscribe to Live BroadcastChannel & LocalStorage for instant Real-time Abandoned Cart Sync!
  useEffect(() => {
    const updateFromActiveCart = (items: CartItem[]) => {
      if (!items || items.length === 0) return;

      const itemsCount = items.reduce((acc, i) => acc + i.quantity, 0);
      const totalVal = items.reduce((acc, i) => acc + i.product.price * i.quantity, 0);

      const orderItems: AdminOrderItem[] = items.map((i) => ({
        id: i.product.id,
        name: i.product.name,
        price: i.product.price,
        quantity: i.quantity,
        weight: i.product.weight || "500 g",
      }));

      const liveCartRecord: AbandonedCart = {
        id: "live_active_cart",
        customerName: profile.name || "Live Active Customer",
        customerPhone: profile.phone || "+91 88602 69736",
        customerEmail: profile.email || "customer@10minute.local",
        items: orderItems,
        totalValue: totalVal,
        totalItems: itemsCount,
        lastActiveStep: "Basket Drawer",
        abandonedTimeAgo: "Just Now (Live)",
        recoveryPingSent: false,
        geocoordinates: { lat: 20.2961, lng: 85.8245 },
      };

      setCarts((prevCarts) => {
        const filtered = prevCarts.filter((c) => c.id !== "live_active_cart");
        return [liveCartRecord, ...filtered];
      });

      setLivePulse(true);
      setTimeout(() => setLivePulse(false), 2000);
    };

    // Check initial active cart in storage
    try {
      const raw = localStorage.getItem("satyug_live_active_cart");
      if (raw) {
        const parsed = JSON.parse(raw);
        updateFromActiveCart(parsed);
      }
    } catch (e) {}

    // Listen to BroadcastChannel events across browser windows & tabs
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel("satyug_abandoned_carts_channel");
      channel.onmessage = (event) => {
        if (event.data && event.data.type === "DRAFT_CART_UPDATE") {
          updateFromActiveCart(event.data.items);
        }
      };
    } catch (e) {}

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "satyug_live_active_cart" && e.newValue) {
        try {
          updateFromActiveCart(JSON.parse(e.newValue));
        } catch (err) {}
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      if (channel) channel.close();
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [profile]);

  const totalValue = carts.reduce((acc, c) => acc + c.totalValue, 0);
  const totalBaskets = carts.length;
  const recoveredCount = carts.filter((c) => c.recoveryPingSent).length;

  const handleSendRecoveryPing = (cart: AbandonedCart) => {
    setCarts(
      carts.map((c) => (c.id === cart.id ? { ...c, recoveryPingSent: true } : c))
    );
    setToastMsg(
      `WhatsApp & SMS Recovery Ping sent to ${cart.customerName} (${cart.customerPhone}) with discount code COMEBACK10!`
    );
    setTimeout(() => setToastMsg(null), 4000);
  };

  const handleDismissCart = (id: string, name: string) => {
    if (confirm(`Dismiss abandoned cart for ${name}?`)) {
      setCarts(carts.filter((c) => c.id !== id));
      if (selectedCart?.id === id) setSelectedCart(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Section Header with Live Stream Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black tracking-tight text-slate-100">
              Abandoned Carts & Recovery Center
            </h2>
            <span className="flex items-center gap-1 rounded-full bg-emerald-950 px-2.5 py-0.5 text-[10px] font-black text-emerald-400 border border-emerald-800 animate-pulse">
              <Radio className="h-3 w-3 text-emerald-400" /> LIVE STREAM
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Real-time synchronization for active customer draft baskets & 1-click WhatsApp recovery
          </p>
        </div>
      </div>

      {toastMsg && (
        <div className="flex items-center gap-2 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 p-4 text-xs font-bold text-emerald-400 animate-in fade-in">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Analytics Counter Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Abandoned Baskets</span>
            <ShoppingBag className="h-5 w-5 text-amber-400" />
          </div>
          <p className="text-2xl font-black text-white">{totalBaskets}</p>
          <p className="text-[11px] text-amber-400 font-medium flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> Real-time active tracking
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Potential Revenue Lost</span>
            <DollarSign className="h-5 w-5 text-rose-400" />
          </div>
          <p className="text-2xl font-black text-rose-400">₹{totalValue}</p>
          <p className="text-[11px] text-slate-400 font-medium">Sum of active basket totals</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Recovery Outreach</span>
            <Send className="h-5 w-5 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-400">{recoveredCount} / {totalBaskets}</p>
          <p className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
            <Zap className="h-3 w-3" /> Pings dispatched via WhatsApp API
          </p>
        </div>
      </div>

      {/* Abandoned Carts Master Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-800 bg-slate-950 text-[11px] font-bold uppercase text-slate-400">
            <tr>
              <th className="py-3.5 px-4">Customer Details</th>
              <th className="py-3.5 px-4">Items & Basket</th>
              <th className="py-3.5 px-4">Last Active Step</th>
              <th className="py-3.5 px-4 text-right">Value</th>
              <th className="py-3.5 px-4 text-center">Status</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80 text-slate-300">
            {carts.map((cart) => (
              <tr
                key={cart.id}
                className={`transition-colors ${
                  cart.id === "live_active_cart"
                    ? "bg-emerald-950/40 hover:bg-emerald-900/40 border-l-4 border-l-emerald-500"
                    : "hover:bg-slate-800/40"
                }`}
              >
                <td className="py-3.5 px-4">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="font-extrabold text-white text-sm">{cart.customerName}</p>
                      {cart.id === "live_active_cart" && (
                        <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] font-black text-slate-950">
                          LIVE ACTIVE
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-mono text-emerald-400 font-bold flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {cart.customerPhone}
                    </p>
                    <p className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Mail className="h-3 w-3" /> {cart.customerEmail}
                    </p>
                  </div>
                </td>

                <td className="py-3.5 px-4">
                  <button
                    onClick={() => setSelectedCart(cart)}
                    className="text-left group"
                  >
                    <p className="font-bold text-slate-200 group-hover:text-emerald-400 transition-colors">
                      {cart.items.length} Product SKUs ({cart.totalItems} total items)
                    </p>
                    <p className="text-[11px] text-slate-400 line-clamp-1">
                      {cart.items.map((i) => `${i.name} (x${i.quantity})`).join(", ")}
                    </p>
                  </button>
                </td>

                <td className="py-3.5 px-4">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-950 px-2.5 py-1 text-[10px] font-bold text-amber-400 border border-slate-800">
                    <Clock className="h-3 w-3" /> {cart.lastActiveStep} ({cart.abandonedTimeAgo})
                  </span>
                </td>

                <td className="py-3.5 px-4 text-right font-mono font-black text-white text-sm">
                  ₹{cart.totalValue}
                </td>

                <td className="py-3.5 px-4 text-center">
                  {cart.recoveryPingSent ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950 px-2.5 py-1 text-[10px] font-black text-emerald-400 border border-emerald-800">
                      <CheckCircle2 className="h-3 w-3" /> PING SENT
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-950 px-2.5 py-1 text-[10px] font-black text-amber-400 border border-amber-800">
                      <AlertCircle className="h-3 w-3" /> UNCONTACTED
                    </span>
                  )}
                </td>

                <td className="py-3.5 px-4 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => handleSendRecoveryPing(cart)}
                      className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold transition-all shadow-sm ${
                        cart.recoveryPingSent
                          ? "bg-slate-800 text-slate-400 border border-slate-700"
                          : "bg-emerald-500 text-slate-950 font-black hover:bg-emerald-400"
                      }`}
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      {cart.recoveryPingSent ? "Resend Ping" : "WhatsApp Ping"}
                    </button>

                    <button
                      onClick={() => handleDismissCart(cart.id, cart.customerName)}
                      className="rounded-xl p-1.5 text-slate-500 hover:bg-rose-950 hover:text-rose-400 transition-colors"
                      title="Dismiss Abandoned Cart"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Itemized Cart Drawer / Modal */}
      {selectedCart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => setSelectedCart(null)}
          />

          <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 p-6 text-white shadow-2xl animate-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-black text-white">
                  Abandoned Basket: {selectedCart.customerName}
                </h3>
                <p className="text-xs text-slate-400 font-mono">{selectedCart.customerPhone}</p>
              </div>
              <button
                onClick={() => setSelectedCart(null)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Basket Items ({selectedCart.items.length})
              </span>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {selectedCart.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs"
                  >
                    <div>
                      <p className="font-bold text-white">{item.name}</p>
                      <p className="text-[10px] text-slate-400">{item.weight}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-emerald-400">₹{item.price * item.quantity}</p>
                      <p className="text-[10px] text-slate-400">Qty: {item.quantity}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400">Total Basket Value</span>
              <span className="text-base font-black text-white font-mono">₹{selectedCart.totalValue}</span>
            </div>

            <button
              onClick={() => {
                handleSendRecoveryPing(selectedCart);
                setSelectedCart(null);
              }}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 shadow-md"
            >
              <Send className="h-4 w-4" /> Send Recovery WhatsApp Ping (10% OFF Code)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
