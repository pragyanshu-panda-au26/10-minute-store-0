"use client";

import { useState } from "react";
import { AdminOrder, OrderStatus } from "@/lib/adminDummyData";
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
} from "lucide-react";

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
  const lat = order.geocoordinates?.lat ?? 20.2961;
  const lng = order.geocoordinates?.lng ?? 85.8245;
  const googleMapsRoutingUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

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
            <div className="pt-2">
              <a
                href={googleMapsRoutingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-extrabold text-white shadow-md shadow-blue-600/30 hover:bg-blue-500 active:scale-95"
              >
                <Navigation className="h-4 w-4" /> Navigate with Google Maps
              </a>
            </div>
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
    </div>
  );
}
