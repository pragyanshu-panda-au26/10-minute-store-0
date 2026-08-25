"use client";

import { useState } from "react";
import { AdminOrder, OrderStatus, PaymentMethod, PaymentStatus } from "@/lib/adminDummyData";
import { staticMapUrl } from "@/lib/googleMaps";
import {
  X,
  MapPin,
  Phone,
  User,
  Clock,
  Navigation,
  CheckCircle2,
  Truck,
  PackageCheck,
  Receipt,
  Loader2,
  XCircle,
  RotateCcw,
  Boxes,
  MessageCircle,
  Printer,
  IndianRupee,
  Banknote,
  CreditCard,
  Wallet,
} from "lucide-react";

// Payment chip metadata — matches the Kanban card so the admin sees the
// same visual language on the card and inside the modal.
const PAYMENT_METHOD_META: Record<PaymentMethod, { label: string; className: string; Icon: any }> = {
  cod:      { label: "Cash on delivery", className: "border-amber-500/40 bg-amber-500/10 text-amber-300", Icon: Banknote },
  razorpay: { label: "Razorpay (Prepaid)", className: "border-sky-500/40 bg-sky-500/10 text-sky-300",     Icon: CreditCard },
};

const PAYMENT_STATUS_META: Record<PaymentStatus, { label: string; className: string }> = {
  pending:  { label: "Unpaid",   className: "border-slate-600/60 bg-slate-800 text-slate-300" },
  paid:     { label: "Paid",     className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" },
  failed:   { label: "Failed",   className: "border-rose-500/40 bg-rose-500/10 text-rose-300" },
  refunded: { label: "Refunded", className: "border-purple-500/40 bg-purple-500/10 text-purple-300" },
};

interface OrderDetailsModalProps {
  order: AdminOrder | null;
  onClose: () => void;
  onUpdateStatus: (orderIdOrNumber: string, newStatus: OrderStatus) => void | Promise<void>;
}

const STATUS_BADGES: Record<OrderStatus, { className: string; label: string }> = {
  pending:          { className: "bg-amber-500/20 text-amber-400 border-amber-500/40",   label: "● Pending" },
  confirmed:        { className: "bg-blue-500/20 text-blue-400 border-blue-500/40",       label: "● Confirmed" },
  packed:           { className: "bg-indigo-500/20 text-indigo-400 border-indigo-500/40", label: "● Packed" },
  out_for_delivery: { className: "bg-purple-500/20 text-purple-400 border-purple-500/40", label: "● Out for Delivery" },
  delivered:        { className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40", label: "✓ Delivered" },
  cancelled:        { className: "bg-rose-500/20 text-rose-400 border-rose-500/40",       label: "✕ Cancelled" },
};

export default function OrderDetailsModal({
  order,
  onClose,
  onUpdateStatus,
}: OrderDetailsModalProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [refundMsg, setRefundMsg] = useState<string | null>(null);

  if (!order) return null;

  const orderKey = order.orderNumber ?? order.id;
  const hasCoords = Number.isFinite(order.geocoordinates?.lat) && Number.isFinite(order.geocoordinates?.lng);
  const lat = order.geocoordinates?.lat ?? 20.2961;
  const lng = order.geocoordinates?.lng ?? 85.8245;
  const googleMapsRoutingUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  // Only render the static-map thumbnail when we actually have real coords —
  // avoids pinning the customer's map on our fallback Bhubaneswar center.
  const mapThumbUrl = hasCoords ? staticMapUrl({ lat, lng, zoom: 16 }) : null;

  // WhatsApp deep-link — strip everything except digits, drop leading zero, prepend country code if missing
  const waDigits = (order.customerPhone || "").replace(/\D/g, "").replace(/^0+/, "");
  const waNumber = waDigits.length === 10 ? `91${waDigits}` : waDigits;
  const waMessage = encodeURIComponent(
    `Hi ${order.customerName?.split(" ")[0] || "there"}! This is your 10minute order #${orderKey} — total ₹${order.totalPrice}. Everything on track!`
  );
  const whatsappUrl = waNumber ? `https://wa.me/${waNumber}?text=${waMessage}` : null;

  // Fall back defensively — older orders (seeded before we captured
  // payment info) can be missing these fields.
  const paymentMethod: PaymentMethod = order.paymentMethod ?? "cod";
  const paymentStatus: PaymentStatus = order.paymentStatus ?? "pending";
  const isCod = paymentMethod === "cod";
  const isPaid = paymentStatus === "paid";
  const isRefunded = paymentStatus === "refunded";
  const canMarkPaid = isCod && !isPaid && !isRefunded;
  const canRefund = isPaid && !isRefunded && order.status !== "cancelled";
  const methodMeta = PAYMENT_METHOD_META[paymentMethod];
  const statusMeta = PAYMENT_STATUS_META[paymentStatus];
  const MethodIcon = methodMeta.Icon;

  const handleStatusChange = async (newStatus: OrderStatus) => {
    setIsUpdating(true);
    try {
      await onUpdateStatus(orderKey, newStatus);
    } catch (error: any) {
      alert(`Failed to update: ${error.message ?? error}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!confirm(`Mark COD order #${orderKey} as paid?\nOnly do this AFTER you've collected ₹${order.totalPrice} cash.`)) return;
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderKey)}/mark-paid`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setRefundMsg(`Cash of ₹${order.totalPrice} recorded as received.`);
    } catch (err: any) {
      alert(err.message ?? "Failed to mark paid");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRefund = async () => {
    const raw = prompt(
      `Refund how much (₹)? Max ₹${order.totalPrice}. Leave blank for full refund.`,
      String(order.totalPrice)
    );
    if (raw === null) return;
    const amount = raw.trim() ? Number(raw) : undefined;
    if (raw.trim() && (!Number.isFinite(amount!) || amount! <= 0)) {
      alert("Enter a valid amount.");
      return;
    }
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderKey)}/refund`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(amount ? { amount } : {}),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setRefundMsg(
        `Refund of ₹${data.refunded} issued via ${isCod ? "cash (recorded)" : "Razorpay to source"}.`
      );
    } catch (err: any) {
      alert(err.message ?? "Refund failed");
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePrint = () => {
    // Uses the CSS `@media print` block below — hides everything except
    // the .receipt-print block, so the browser only prints the receipt.
    if (typeof window !== "undefined") window.print();
  };

  const handleCancelAndRefund = async () => {
    if (!confirm(`Cancel Order #${orderKey} and issue refund of ₹${order.totalPrice}?`)) return;
    await handleStatusChange("cancelled");
    setRefundMsg(`Refund of ₹${order.totalPrice} initiated for ${order.customerName}`);
  };

  const badge = STATUS_BADGES[order.status];

  const nextActions: { status: OrderStatus; label: string; className: string; Icon: any }[] = [
    { status: "confirmed",         label: "Confirm order",   className: "bg-blue-600 hover:bg-blue-500 shadow-blue-600/30",       Icon: PackageCheck },
    { status: "packed",            label: "Mark packed",     className: "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30", Icon: Boxes },
    { status: "out_for_delivery",  label: "Head out",        className: "bg-purple-600 hover:bg-purple-500 shadow-purple-600/30", Icon: Truck },
    { status: "delivered",         label: "Mark delivered",  className: "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30", Icon: CheckCircle2 },
  ];

  const currentIdx = ["pending", "confirmed", "packed", "out_for_delivery", "delivered"].indexOf(order.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => !isUpdating && onClose()} />

      <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/70 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-black tracking-tight text-white">Order #{orderKey}</h3>
                <span className={`rounded-full px-3 py-1 text-xs font-bold border ${badge.className}`}>
                  {badge.label}
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                <Clock className="h-3 w-3 text-slate-500" /> Placed {new Date(order.createdAt).toLocaleString()}
              </p>
              {order.scheduledFor && (
                <p className="text-[11px] text-purple-300 font-bold flex items-center gap-1 mt-1">
                  <Clock className="h-3 w-3" />
                  Scheduled for {new Date(order.scheduledFor).toLocaleString("en-IN", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  })}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isUpdating}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto p-6 space-y-6">
          {refundMsg && (
            <div className="flex items-center gap-2 rounded-2xl bg-emerald-950 p-4 text-xs font-bold text-emerald-400 border border-emerald-800">
              <RotateCcw className="h-4 w-4" /> {refundMsg}
            </div>
          )}

          {/* Customer + address */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Delivery details</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2.5 text-slate-300">
                <User className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                <span className="font-bold text-slate-100">{order.customerName}</span>
              </div>
              <div className="flex items-center gap-2.5 text-slate-300">
                <Phone className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                <a href={`tel:${order.customerPhone}`} className="font-bold text-emerald-400 hover:underline">
                  {order.customerPhone}
                </a>
              </div>
            </div>
            <div className="flex items-start gap-2.5 pt-1 text-xs text-slate-300">
              <MapPin className="h-4 w-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <span className="font-medium text-slate-200">{order.deliveryAddress}</span>
            </div>

            {/* Static Google Map thumbnail — clickable → opens directions. */}
            {mapThumbUrl && (
              <a
                href={googleMapsRoutingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block overflow-hidden rounded-xl border border-slate-800 hover:border-blue-500/60 transition-colors"
                title="Open directions in Google Maps"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mapThumbUrl}
                  alt="Delivery location on map"
                  loading="lazy"
                  className="w-full h-32 object-cover"
                />
              </a>
            )}

            <div className="pt-2 flex flex-wrap gap-2">
              <a
                href={googleMapsRoutingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-extrabold text-white shadow-md shadow-blue-600/30 hover:bg-blue-500 active:scale-95"
              >
                <Navigation className="h-4 w-4" /> Navigate
              </a>
              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-3 py-2 text-xs font-extrabold text-white shadow-md hover:bg-[#20b358] active:scale-95"
                >
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </a>
              )}
              <a
                href={`tel:${order.customerPhone}`}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-3 py-2 text-xs font-extrabold text-white hover:bg-slate-700 active:scale-95"
              >
                <Phone className="h-4 w-4" /> Call
              </a>
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-3 py-2 text-xs font-extrabold text-white hover:bg-slate-700 active:scale-95"
              >
                <Printer className="h-4 w-4" /> Print
              </button>
              {canMarkPaid && (
                <button
                  onClick={handleMarkPaid}
                  disabled={isUpdating}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white shadow-md hover:bg-emerald-500 disabled:opacity-60 active:scale-95"
                >
                  {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
                  Cash received (₹{order.totalPrice})
                </button>
              )}
              {canRefund && (
                <button
                  onClick={handleRefund}
                  disabled={isUpdating}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-3 py-2 text-xs font-extrabold text-white shadow-md hover:bg-amber-500 disabled:opacity-60 active:scale-95"
                >
                  {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <IndianRupee className="h-4 w-4" />}
                  Refund
                </button>
              )}
            </div>
          </div>

          {/* Payment — method + status + refund amount if any. Sits above
              the itemized list so the admin knows how to collect (or that
              they've already been collected from) before they read what to
              pack. */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5 text-emerald-400" />
              Payment
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Method</p>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-extrabold ${methodMeta.className}`}
                >
                  <MethodIcon className="h-3.5 w-3.5" />
                  {methodMeta.label}
                </span>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Status</p>
                <span
                  className={`inline-flex items-center rounded-lg border px-2 py-1 text-xs font-extrabold ${statusMeta.className}`}
                >
                  {statusMeta.label}
                </span>
              </div>
            </div>
            {/* Refund line — only when we've actually paid something back.
                Guards against the `refundAmount = 0` case (unrefunded
                orders default to 0, we don't want a ghost row saying
                "Refunded ₹0" everywhere). */}
            {typeof order.refundAmount === "number" && order.refundAmount > 0 && (
              <div className="flex items-center justify-between rounded-xl bg-purple-950/50 border border-purple-800/60 px-3 py-2 text-xs">
                <span className="font-bold text-purple-200 flex items-center gap-1.5">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Refunded to customer
                </span>
                <span className="font-black text-purple-300">₹{order.refundAmount}</span>
              </div>
            )}
            {/* COD hint — tells the admin exactly how much to collect
                on delivery for an unpaid cash order. */}
            {isCod && !isPaid && !isRefunded && (
              <p className="text-[11px] text-amber-300/90 flex items-center gap-1.5">
                <Banknote className="h-3.5 w-3.5" />
                Collect ₹{order.totalPrice} in cash from the customer on delivery.
              </p>
            )}
          </div>

          {/* Itemized */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Items</h4>
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/80">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 bg-slate-950 text-[10px] uppercase font-bold text-slate-500">
                  <tr>
                    <th className="py-2.5 px-4">Item</th>
                    <th className="py-2.5 px-4 text-center">Qty</th>
                    <th className="py-2.5 px-4 text-right">Price</th>
                    <th className="py-2.5 px-4 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-3 px-4 font-bold text-slate-100">{item.name}</td>
                      <td className="py-3 px-4 text-center font-extrabold text-emerald-400">{item.quantity}x</td>
                      <td className="py-3 px-4 text-right text-slate-400">₹{item.price}</td>
                      <td className="py-3 px-4 text-right font-black text-slate-100">₹{item.price * item.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-between items-center border-t border-slate-800 bg-slate-950 p-4 font-black text-sm text-white">
                <span>Grand Total ({order.totalItems} items)</span>
                <span className="text-emerald-400 text-base">₹{order.totalPrice}</span>
              </div>
            </div>
          </div>

          {/* Status transitions */}
          <div className="space-y-2 pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Move order forward</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {nextActions.map(({ status, label, className, Icon }, idx) => {
                const isDone = idx <= currentIdx;
                const isCancelled = order.status === "cancelled";
                const disabled = isUpdating || isDone || isCancelled;
                return (
                  <button
                    key={status}
                    onClick={() => handleStatusChange(status)}
                    disabled={disabled}
                    className={`flex items-center justify-center gap-1.5 rounded-xl py-3 px-2 text-[11px] font-extrabold transition-all shadow-md ${
                      disabled ? "bg-slate-800 text-slate-500 cursor-not-allowed opacity-60" : `text-white ${className} active:scale-95`
                    }`}
                  >
                    {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="pt-2">
              <button
                onClick={handleCancelAndRefund}
                disabled={isUpdating || order.status === "cancelled" || order.status === "delivered"}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-rose-950 text-rose-400 border border-rose-800/80 py-2.5 text-xs font-extrabold hover:bg-rose-900/60 disabled:opacity-50"
              >
                <XCircle className="h-4 w-4 text-rose-500" />
                Cancel & Refund (₹{order.totalPrice})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Print-only receipt (58 mm thermal) ─────────────
          Hidden on screen; only visible during `window.print()`. The
          @media-print styles below hide EVERYTHING except this block. */}
      <div className="hidden print:block receipt-print">
        <style>{`
          @media print {
            @page { size: 58mm auto; margin: 4mm; }
            body { background: white !important; }
            body > *:not(.receipt-print-root) { display: none !important; }
            .receipt-print-root { display: block !important; position: fixed; inset: 0; z-index: 9999; background: white; color: black; font-family: 'Courier New', monospace; font-size: 11px; padding: 2mm; }
            .receipt-print { display: block !important; }
          }
        `}</style>
        <div className="receipt-print-root">
          <div style={{ textAlign: "center", fontWeight: 900, fontSize: 14 }}>
            SATYUG 10-MIN STORE
          </div>
          <div style={{ textAlign: "center", fontSize: 10, marginBottom: 6 }}>
            Order #{orderKey}
          </div>
          <div style={{ borderTop: "1px dashed black", margin: "4px 0" }} />
          <div>
            <div><strong>To:</strong> {order.customerName}</div>
            <div>{order.customerPhone}</div>
            <div style={{ marginTop: 2 }}>{order.deliveryAddress}</div>
          </div>
          <div style={{ borderTop: "1px dashed black", margin: "4px 0" }} />
          <div>
            {order.items.map((it) => (
              <div key={it.id} style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{it.quantity}× {it.name}</span>
                <span>₹{it.price * it.quantity}</span>
              </div>
            ))}
          </div>
          <div style={{ borderTop: "1px dashed black", margin: "4px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900, fontSize: 12 }}>
            <span>TOTAL</span>
            <span>₹{order.totalPrice}</span>
          </div>
          <div style={{ marginTop: 2, fontSize: 10 }}>
            Payment: {paymentMethod.toUpperCase()} · {paymentStatus.toUpperCase()}
          </div>
          <div style={{ borderTop: "1px dashed black", margin: "4px 0" }} />
          <div style={{ textAlign: "center", fontSize: 9, marginTop: 4 }}>
            Placed {new Date(order.createdAt).toLocaleString()}
          </div>
          <div style={{ textAlign: "center", fontSize: 9, marginTop: 8 }}>
            Thank you! 🙏
          </div>
        </div>
      </div>
    </div>
  );
}
