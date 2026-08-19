"use client";

import { useState } from "react";
import { useCartStore, AVAILABLE_PROMOS } from "@/store/useCartStore";
import { Tag, Check, X, Sparkles } from "lucide-react";

export default function PromoCodeEngine() {
  const [inputCode, setInputCode] = useState("");
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const { appliedPromo, applyServerPromo, removePromoCode } = useCartStore();

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) return;

    // Server-validated — see cart store note. Prevents the UI from ever
    // "applying" a promo the server won't actually honor.
    const res = await applyServerPromo(inputCode);
    if (res.success) {
      setMsg({ type: "success", text: res.message });
      setInputCode("");
    } else {
      setMsg({ type: "error", text: res.message });
    }
  };

  const handleQuickApply = async (code: string) => {
    const res = await applyServerPromo(code);
    if (res.success) {
      setMsg({ type: "success", text: res.message });
    } else {
      setMsg({ type: "error", text: res.message });
    }
  };

  return (
    <div className="space-y-3 rounded-2xl bg-slate-100/70 p-3.5 border border-slate-200/80">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
          <Tag className="h-4 w-4 text-emerald-600" />
          Coupons & Offers
        </span>
        {appliedPromo && (
          <button
            onClick={removePromoCode}
            className="flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:underline"
          >
            <X className="h-3 w-3" /> Remove
          </button>
        )}
      </div>

      {appliedPromo ? (
        <div className="flex items-center justify-between rounded-xl bg-emerald-100 p-2.5 text-xs font-bold text-emerald-900 border border-emerald-300">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-600" />
            <span>
              Coupon <strong>{appliedPromo.code}</strong> Applied!
            </span>
          </div>
          <Check className="h-4 w-4 text-emerald-600" />
        </div>
      ) : (
        <>
          <form onSubmit={handleApply} className="flex gap-2">
            <input
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              placeholder="Enter Promo Code (e.g. SATYUG50)"
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold uppercase text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-emerald-500"
            >
              Apply
            </button>
          </form>

          {/* Quick Apply Coupons List */}
          <div className="space-y-1.5 pt-1">
            <p className="text-[10px] uppercase font-bold text-slate-400">Available Offers</p>
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {AVAILABLE_PROMOS.map((p) => (
                <button
                  key={p.code}
                  onClick={() => handleQuickApply(p.code)}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:border-emerald-500 hover:bg-emerald-50 flex-shrink-0"
                >
                  <Tag className="h-3 w-3 text-emerald-600" />
                  <span>{p.code}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {msg && (
        <p
          className={`text-[11px] font-bold ${
            msg.type === "success" ? "text-emerald-700" : "text-rose-600"
          }`}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}
