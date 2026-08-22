"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOrderStore } from "@/store/useOrderStore";
import { useCartStore } from "@/store/useCartStore";
import { useProductStore } from "@/store/useProductStore";
import { AdminOrder } from "@/lib/adminDummyData";
import MobileBottomNav from "@/components/customer/MobileBottomNav";
import { OrdersListSkeleton } from "@/components/customer/Skeleton";
import {
  ArrowLeft,
  History,
  RotateCcw,
  FileText,
  Printer,
  ChevronRight,
  X,
  Truck,
  Loader2,
  CreditCard,
  Banknote,
} from "lucide-react";

export default function OrderHistoryPage() {
  const router = useRouter();
  const { orders, loading, fetchOrders } = useOrderStore();
  const { addItem } = useCartStore();
  const { products, fetchProducts } = useProductStore();
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<AdminOrder | null>(null);
  const [reorderMsg, setReorderMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
    // Load current catalog so reorder resolves against fresh prices + stock
    if (products.length === 0) fetchProducts();
  }, [fetchOrders, fetchProducts, products.length]);

  /**
   * Reorder: for each line in the historical order, find the matching product
   * in the CURRENT catalog and add it to cart. Skip anything missing or
   * out of stock, and report the result so the user knows.
   */
  const handleReorder = (order: AdminOrder) => {
    const productMap = new Map(products.map((p) => [p.id, p]));
    let added = 0;
    const skipped: string[] = [];

    for (const item of order.items) {
      const productId = (item as any).productId || item.id;
      const p = productMap.get(productId);
      if (!p || (p.stock ?? 0) <= 0) {
        skipped.push(item.name);
        continue;
      }
      // Try to match the historical variant if it still exists
      const historicalVariantId = (item as any).variantId as string | undefined;
      const variant = historicalVariantId
        ? p.variants?.find((v) => v.id === historicalVariantId)
        : null;
      // Add `quantity` copies — only count a real add. An item with
      // quantity 0 (or a coerced NaN) would otherwise still bump `added`.
      const times = Math.max(0, Math.floor(item.quantity || 0));
      if (times === 0) continue;
      for (let i = 0; i < times; i++) {
        addItem(p as any, (variant as any) ?? null);
      }
      added += times;
    }

    if (added === 0) {
      setReorderMsg("None of those items are available right now.");
      return;
    }
    setReorderMsg(
      skipped.length > 0
        ? `Added ${added} item${added === 1 ? "" : "s"}. Skipped: ${skipped.join(", ")}.`
        : `Added ${added} item${added === 1 ? "" : "s"} to your basket.`
    );
    // Navigate immediately — the previous 600 ms setTimeout was a race with
    // any other tap the user made in that window (route change vs. click).
    router.push("/cart");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-28">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md px-4 py-3">
        <div className="mx-auto max-w-xl flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-emerald-700 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" /> Store
          </button>
          <h1 className="text-base font-black text-slate-900">
            Order History & Invoices
          </h1>
          <div className="w-10" />
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-xl px-4 py-4 space-y-4">
        {reorderMsg && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800 flex items-start justify-between gap-2">
            <span>{reorderMsg}</span>
            <button
              type="button"
              onClick={() => setReorderMsg(null)}
              className="text-emerald-700 hover:text-emerald-900"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {loading && orders.length === 0 ? (
          // Skeleton stack instead of the previous spinner — the shape gives
          // the customer a preview of what the list will look like.
          <OrdersListSkeleton rows={3} />
        ) : orders.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center space-y-3 shadow-xs">
            <History className="mx-auto h-12 w-12 text-slate-300" />
            <h2 className="text-base font-bold text-slate-800">No past orders yet</h2>
            <p className="text-xs text-slate-500">
              Start shopping to get express 10-minute delivery.
            </p>
            <Link
              href="/"
              className="inline-block rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-500"
            >
              Explore Storefront
            </Link>
          </div>
        ) : (
          orders.map((ord) => {
            // Only trust the explicit paymentStatus flag. The previous
            // `|| paymentMethod === "razorpay"` fallback labeled every Razorpay
            // order PAID even when payment had failed / been cancelled and the
            // signature never verified.
            const isPaid = ord.paymentStatus === "paid";
            return (
              <div
                key={ord.id}
                className="rounded-3xl border border-slate-200 bg-white p-5 space-y-3.5 shadow-xs hover:border-slate-300 transition-all"
              >
                {/* Top Header */}
                <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-black text-slate-900">
                        #{ord.orderNumber || ord.id}
                      </span>
                      
                      {/* Order Status Badge */}
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black text-emerald-800 uppercase">
                        {ord.status.replace(/_/g, " ")}
                      </span>

                      {/* Payment Status Badge */}
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                          isPaid
                            ? "bg-emerald-500/15 text-emerald-700 border border-emerald-300"
                            : "bg-amber-100 text-amber-900 border border-amber-300"
                        }`}
                      >
                        {isPaid ? (
                          <>
                            <CreditCard className="h-3 w-3" /> PAID
                          </>
                        ) : (
                          <>
                            <Banknote className="h-3 w-3" /> COD (PENDING)
                          </>
                        )}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 mt-1">
                      Placed {ord.createdAt ? new Date(ord.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Recently"} • {ord.totalItems} items
                    </p>
                  </div>

                  <p className="text-base font-black text-slate-900">
                    ₹{ord.totalPrice}
                  </p>
                </div>

                {/* Items Summary */}
                <div className="space-y-1">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Itemised Summary:
                  </p>
                  <p className="text-xs text-slate-700 font-medium leading-relaxed">
                    {ord.items.map((i) => `${i.quantity}x ${i.name}`).join(" • ")}
                  </p>
                </div>

                {/* Delivery Address Snapshot */}
                <div className="rounded-2xl bg-slate-50 p-2.5 border border-slate-100 text-[11px] text-slate-600 truncate">
                  <span className="font-bold text-slate-900">Delivery: </span>
                  {ord.deliveryAddress}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <Link
                    href={`/orders/${ord.orderNumber || ord.id}/track`}
                    className="flex items-center gap-1 text-xs font-black text-emerald-600 hover:text-emerald-700"
                  >
                    <Truck className="h-4 w-4" />
                    <span>Track order</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedInvoiceOrder(ord)}
                      className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                    >
                      <FileText className="h-3.5 w-3.5 text-blue-600" />
                      Invoice PDF
                    </button>

                    <button
                      onClick={() => handleReorder(ord)}
                      className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-extrabold text-white shadow-xs hover:bg-emerald-500 active:scale-95 transition-all cursor-pointer"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reorder
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </main>

      {/* PDF Tax Invoice Modal */}
      {selectedInvoiceOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md animate-in fade-in"
            onClick={() => setSelectedInvoiceOrder(null)}
          />

          <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl bg-white p-6 text-slate-900 shadow-2xl animate-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  TAX INVOICE #{selectedInvoiceOrder.orderNumber || selectedInvoiceOrder.id}
                </h3>
                <p className="text-[11px] text-slate-500">
                  10minute — operated by Veloz Technologies Pvt Ltd • GSTIN 21AABCV1234F1Z0
                </p>
              </div>
              <button
                onClick={() => setSelectedInvoiceOrder(null)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 max-h-[65vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <div>
                  <p className="font-bold text-slate-700">Customer Details:</p>
                  <p className="text-slate-900 font-bold">{selectedInvoiceOrder.customerName}</p>
                  <p className="text-slate-500 font-mono">{selectedInvoiceOrder.customerPhone}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-700">Payment Status:</p>
                  <p
                    className={`font-bold uppercase ${
                      selectedInvoiceOrder.paymentStatus === "paid"
                        ? "text-emerald-700"
                        : "text-amber-700"
                    }`}
                  >
                    {selectedInvoiceOrder.paymentStatus || "PENDING"}
                  </p>
                  <p className="text-slate-500 capitalize">{selectedInvoiceOrder.paymentMethod || "online"}</p>
                </div>
              </div>

              <div className="text-xs bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <p className="font-bold text-slate-700">Billed Delivery Address:</p>
                <p className="text-slate-600 mt-0.5">{selectedInvoiceOrder.deliveryAddress}</p>
              </div>

              {/* Itemized Table */}
              <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-100 font-bold text-slate-700 text-[10px] uppercase">
                  <tr>
                    <th className="p-2.5">Item Description</th>
                    <th className="p-2.5 text-center">Qty</th>
                    <th className="p-2.5 text-right">Unit Price</th>
                    <th className="p-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedInvoiceOrder.items.map((it) => (
                    <tr key={it.id}>
                      <td className="p-2.5 font-semibold text-slate-800">{it.name}</td>
                      <td className="p-2.5 text-center text-slate-600">{it.quantity}</td>
                      <td className="p-2.5 text-right text-slate-600">₹{it.price}</td>
                      <td className="p-2.5 text-right font-bold text-slate-900">
                        ₹{it.price * it.quantity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {(() => {
                // Split the total into pre-tax base + 5% GST *actually included*
                // in the total, so the arithmetic on-screen adds up. The old
                // version showed total AND "GST (5%)" as separate numeric lines
                // even though Grand Total equaled the pre-GST subtotal — the
                // rows didn't sum to the total.
                const total = selectedInvoiceOrder.totalPrice;
                const gstInclusive = Math.round((total * 5) / 105);
                const baseInclusive = total - gstInclusive;
                return (
                  <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-200">
                    <div className="flex justify-between">
                      <span>Item Subtotal (excl. GST)</span>
                      <span>₹{baseInclusive}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>GST @ 5%</span>
                      <span>₹{gstInclusive}</span>
                    </div>
                    <div className="flex justify-between font-black text-sm text-slate-900 pt-2 border-t">
                      <span>Grand Total Paid (incl. GST)</span>
                      <span className="text-emerald-700">₹{total}</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="mt-4">
              <button
                onClick={() => window.print()}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3 text-xs font-bold text-white hover:bg-slate-800 cursor-pointer"
              >
                <Printer className="h-4 w-4" /> Print / Save Tax Invoice PDF
              </button>
            </div>
          </div>
        </div>
      )}

      <MobileBottomNav />
    </div>
  );
}
