"use client";

import { useState } from "react";
import {
  CreditCard,
  QrCode,
  Banknote,
  Building2,
  CheckCircle2,
  ShieldCheck,
  X,
  Lock,
  ChevronRight,
} from "lucide-react";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  grandTotal: number;
  onConfirmPayment: (method: string) => void;
}

export default function PaymentModal({
  isOpen,
  onClose,
  grandTotal,
  onConfirmPayment,
}: PaymentModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<string>("upi");
  const [upiId, setUpiId] = useState("aarav@upi");
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handlePay = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      onConfirmPayment(selectedMethod);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md animate-in fade-in"
        onClick={() => !isProcessing && onClose()}
      />

      {/* Payment Gateway Dialog */}
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl bg-white text-slate-900 shadow-2xl animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 font-bold">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                Satyug Secure Checkout
              </h3>
              <p className="text-xs text-slate-500">
                256-Bit SSL Encrypted Gateway
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Total Price Header */}
        <div className="bg-emerald-950 p-4 text-white text-center">
          <p className="text-xs text-emerald-300 font-semibold uppercase tracking-wider">
            Total Amount Payable
          </p>
          <p className="text-2xl font-black mt-0.5">₹{grandTotal}</p>
        </div>

        {/* Payment Methods Options */}
        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Select Payment Option
          </p>

          {/* Option 1: Instant UPI */}
          <div
            onClick={() => setSelectedMethod("upi")}
            className={`rounded-2xl border p-4 cursor-pointer transition-all ${
              selectedMethod === "upi"
                ? "border-emerald-500 bg-emerald-50/60 shadow-xs"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
                  <QrCode className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">
                    UPI Instant (Google Pay, PhonePe, Paytm)
                  </h4>
                  <p className="text-[11px] text-slate-500">Zero extra charges</p>
                </div>
              </div>
              <input
                type="radio"
                checked={selectedMethod === "upi"}
                onChange={() => setSelectedMethod("upi")}
                className="h-4 w-4 accent-emerald-600"
              />
            </div>

            {selectedMethod === "upi" && (
              <div className="mt-3 pt-3 border-t border-emerald-200/60 space-y-2">
                <input
                  type="text"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  placeholder="Enter UPI ID (e.g. mobile@upi)"
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-900 focus:border-emerald-500 focus:outline-none"
                />
                <div className="flex gap-2 text-[10px] font-bold text-slate-500">
                  <span className="rounded bg-slate-200 px-2 py-0.5">GPay</span>
                  <span className="rounded bg-slate-200 px-2 py-0.5">PhonePe</span>
                  <span className="rounded bg-slate-200 px-2 py-0.5">Paytm</span>
                  <span className="rounded bg-slate-200 px-2 py-0.5">BHIM</span>
                </div>
              </div>
            )}
          </div>

          {/* Option 2: Credit / Debit Card */}
          <div
            onClick={() => setSelectedMethod("card")}
            className={`rounded-2xl border p-4 cursor-pointer transition-all ${
              selectedMethod === "card"
                ? "border-emerald-500 bg-emerald-50/60 shadow-xs"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">
                    Credit / Debit Card
                  </h4>
                  <p className="text-[11px] text-slate-500">Visa, Mastercard, RuPay</p>
                </div>
              </div>
              <input
                type="radio"
                checked={selectedMethod === "card"}
                onChange={() => setSelectedMethod("card")}
                className="h-4 w-4 accent-emerald-600"
              />
            </div>
          </div>

          {/* Option 3: NetBanking */}
          <div
            onClick={() => setSelectedMethod("netbanking")}
            className={`rounded-2xl border p-4 cursor-pointer transition-all ${
              selectedMethod === "netbanking"
                ? "border-emerald-500 bg-emerald-50/60 shadow-xs"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">
                    NetBanking
                  </h4>
                  <p className="text-[11px] text-slate-500">HDFC, ICICI, SBI, Axis</p>
                </div>
              </div>
              <input
                type="radio"
                checked={selectedMethod === "netbanking"}
                onChange={() => setSelectedMethod("netbanking")}
                className="h-4 w-4 accent-emerald-600"
              />
            </div>
          </div>

          {/* Option 4: Cash on Delivery */}
          <div
            onClick={() => setSelectedMethod("cod")}
            className={`rounded-2xl border p-4 cursor-pointer transition-all ${
              selectedMethod === "cod"
                ? "border-emerald-500 bg-emerald-50/60 shadow-xs"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <Banknote className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">
                    Cash on Delivery (COD)
                  </h4>
                  <p className="text-[11px] text-slate-500">Pay cash or UPI upon delivery</p>
                </div>
              </div>
              <input
                type="radio"
                checked={selectedMethod === "cod"}
                onChange={() => setSelectedMethod("cod")}
                className="h-4 w-4 accent-emerald-600"
              />
            </div>
          </div>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 pt-2">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>Guaranteed 10-Minute Express Delivery</span>
          </div>

          <button
            onClick={handlePay}
            disabled={isProcessing}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 active:scale-95 transition-all disabled:opacity-75"
          >
            {isProcessing ? (
              <span>Authorizing Payment...</span>
            ) : (
              <>
                Pay ₹{grandTotal} & Place Order
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
