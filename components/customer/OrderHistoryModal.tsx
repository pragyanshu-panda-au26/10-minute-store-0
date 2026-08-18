"use client";

import { useState } from "react";
import { AdminOrder } from "@/lib/adminDummyData";
import { useOrderStore } from "@/store/useOrderStore";
import { useCartStore } from "@/store/useCartStore";
import {
  X,
  History,
  ShoppingBag,
  RotateCcw,
  FileText,
  Printer,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";

interface OrderHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTrackOrder: (order: AdminOrder) => void;
}

export default function OrderHistoryModal({
  isOpen,
  onClose,
  onTrackOrder,
}: OrderHistoryModalProps) {
  const { orders } = useOrderStore();
  const { addItem } = useCartStore();
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<AdminOrder | null>(null);

  if (!isOpen) return null;

  // 1-Click Reorder Action
  const handleReorder = (order: AdminOrder) => {
    order.items.forEach((item) => {
      addItem({
        id: item.id,
        name: item.name,
        price: item.price,
        category: "Reordered",
        imageUrl: item.imageUrl || "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=500&auto=format&fit=crop&q=80",
      });
    });
    alert(`Added ${order.items.length} items from Order #${order.id} to your basket!`);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-slate-950/75 backdrop-blur-md animate-in fade-in"
          onClick={onClose}
        />

        {/* Modal Container */}
        <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-3xl bg-white text-slate-900 shadow-2xl animate-in zoom-in-95">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 font-bold">
                <History className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Your Order History
                </h3>
                <p className="text-xs text-slate-500">
                  Track live orders, reorder past items, or download PDF tax invoices
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Orders List */}
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            {orders.length === 0 ? (
              <div className="text-center py-10 text-slate-500">
                <ShoppingBag className="mx-auto h-10 w-10 text-slate-300 mb-2" />
                <p className="font-bold text-sm">No past orders yet</p>
              </div>
            ) : (
              orders.map((ord) => (
                <div
                  key={ord.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-3 hover:border-slate-300 transition-all"
                >
                  {/* Card Top */}
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black text-slate-900">
                          #{ord.id}
                        </span>
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          {ord.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Placed on {ord.createdAt} • {ord.totalItems} items
                      </p>
                    </div>

                    <p className="text-base font-black text-slate-900">
                      ₹{ord.totalPrice}
                    </p>
                  </div>

                  {/* Items Preview */}
                  <p className="text-xs text-slate-600 line-clamp-1">
                    {ord.items.map((i) => `${i.quantity}x ${i.name}`).join(", ")}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={() => onTrackOrder(ord)}
                      className="flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700"
                    >
                      <span>Track Live Dispatch</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>

                    <div className="flex items-center gap-2">
                      {/* PDF Invoice Button */}
                      <button
                        onClick={() => setSelectedInvoiceOrder(ord)}
                        className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
                      >
                        <FileText className="h-3.5 w-3.5 text-blue-600" />
                        Invoice PDF
                      </button>

                      {/* 1-Click Reorder Button */}
                      <button
                        onClick={() => handleReorder(ord)}
                        className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-500 active:scale-95"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Reorder All
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* PDF Tax Invoice Modal Preview */}
      {selectedInvoiceOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md animate-in fade-in"
            onClick={() => setSelectedInvoiceOrder(null)}
          />

          <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl bg-white p-6 text-slate-900 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  TAX INVOICE #INV-{selectedInvoiceOrder.id}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Veloz Technologies Private Limited • GSTIN: 21AABCV1234F1Z0
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
              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-2xl">
                <div>
                  <p className="font-bold text-slate-700">Customer Details:</p>
                  <p className="text-slate-900 font-semibold">{selectedInvoiceOrder.customerName}</p>
                  <p className="text-slate-500">{selectedInvoiceOrder.customerPhone}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-700">Billed Address:</p>
                  <p className="text-slate-500">{selectedInvoiceOrder.deliveryAddress}</p>
                </div>
              </div>

              {/* Itemized Table */}
              <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-100 font-bold text-slate-700 text-[10px] uppercase">
                  <tr>
                    <th className="p-2">Item</th>
                    <th className="p-2 text-center">Qty</th>
                    <th className="p-2 text-right">Price</th>
                    <th className="p-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedInvoiceOrder.items.map((it) => (
                    <tr key={it.id}>
                      <td className="p-2 font-semibold text-slate-800">{it.name}</td>
                      <td className="p-2 text-center text-slate-600">{it.quantity}</td>
                      <td className="p-2 text-right text-slate-600">₹{it.price}</td>
                      <td className="p-2 text-right font-bold text-slate-900">
                        ₹{it.price * it.quantity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="space-y-1 text-xs text-slate-600 pt-2 border-t border-slate-200">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>₹{selectedInvoiceOrder.totalPrice}</span>
                </div>
                <div className="flex justify-between">
                  <span>GST (5% Included)</span>
                  <span>₹{Math.round(selectedInvoiceOrder.totalPrice * 0.05)}</span>
                </div>
                <div className="flex justify-between font-black text-sm text-slate-900 pt-1 border-t">
                  <span>Total Paid</span>
                  <span className="text-emerald-700">₹{selectedInvoiceOrder.totalPrice}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-xs font-bold text-white hover:bg-slate-800"
              >
                <Printer className="h-4 w-4" /> Print / Save PDF Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
