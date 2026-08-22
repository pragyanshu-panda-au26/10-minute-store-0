"use client";

import { useState } from "react";
import {
  Receipt,
  Heart,
  MessageSquare,
  Bell,
  DoorOpen,
  BellOff,
  Phone,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";

/**
 * Blinkit-style bill breakdown + delivery-instruction card for checkout.
 *
 * Server is the source of truth for money — we just show it here and hand the
 * user's chosen tip/notes back on submit. The `handlingFee` shown here mirrors
 * what the server will re-compute (₹2 default, waived when free-delivery kicks in).
 */

export interface BillNumbers {
  subtotal: number; // rupees
  deliveryFee: number;
  handlingFee: number;
  discount: number;
  couponCode?: string | null;
}

interface CheckoutBillCardProps {
  bill: BillNumbers;
  tip: number; // rupees
  onTipChange: (tip: number) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
}

// UX-19 — tip presets keyed to subtotal, not fixed rupee amounts. A ₹50 tip
// on a ₹99 order reads as "half my meal is a tip"; the same ₹50 on ₹899
// barely registers. Percent-anchored + snapped to the nearest ₹5 keeps the
// number legible while staying proportional.
const TIP_PERCENTS = [0, 3, 5, 7] as const;

function suggestTip(subtotal: number, pct: number): number {
  if (pct === 0) return 0;
  // Minimum tip suggestion is ₹5 — anything smaller reads as insulting.
  const raw = (subtotal * pct) / 100;
  const rounded = Math.round(raw / 5) * 5;
  return Math.max(5, rounded);
}

const INSTRUCTION_PRESETS: { label: string; icon: any; text: string }[] = [
  { label: "Don't ring bell", icon: BellOff, text: "Please don't ring the bell." },
  { label: "Leave at door", icon: DoorOpen, text: "Leave at the door." },
  { label: "Call on arrival", icon: Phone, text: "Please call on arrival." },
  { label: "Avoid the dog", icon: Bell, text: "Careful — dog on premises." },
];

export default function CheckoutBillCard({
  bill,
  tip,
  onTipChange,
  notes,
  onNotesChange,
}: CheckoutBillCardProps) {
  const [expanded, setExpanded] = useState(true);
  const total = Math.max(
    0,
    bill.subtotal + bill.deliveryFee + bill.handlingFee - bill.discount + tip
  );

  const togglePreset = (text: string) => {
    if (notes.includes(text)) {
      onNotesChange(notes.replace(text, "").replace(/\s{2,}/g, " ").trim());
    } else {
      onNotesChange((notes ? notes + " " : "") + text);
    }
  };

  return (
    <div className="space-y-3">
      {/* ─── Tip the delivery hero ───────────────────────────── */}
      <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
            <Heart className="h-4 w-4 fill-current" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-slate-900">
              Tip your delivery partner
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              100 % goes to the owner delivering your order.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {TIP_PERCENTS.map((pct) => {
                const amount = suggestTip(bill.subtotal, pct);
                const active = tip === amount;
                return (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => onTipChange(amount)}
                    className={`rounded-full border px-3 py-1 text-xs font-black transition-all ${
                      active
                        ? "border-rose-600 bg-rose-600 text-white shadow"
                        : "border-rose-200 bg-white text-rose-700 hover:border-rose-300"
                    }`}
                    title={pct === 0 ? "No tip" : `${pct}% of ₹${bill.subtotal}`}
                  >
                    {pct === 0 ? "No tip" : `₹${amount}`}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Delivery instructions ───────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="h-4 w-4 text-slate-500" />
          <p className="text-xs font-black text-slate-900">Delivery instructions</p>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {INSTRUCTION_PRESETS.map(({ label, icon: Icon, text }) => {
            const active = notes.includes(text);
            return (
              <button
                key={label}
                type="button"
                onClick={() => togglePreset(text)}
                className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-all ${
                  active
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 text-slate-700 hover:border-slate-300"
                }`}
              >
                <Icon className="h-3 w-3" />
                {label}
              </button>
            );
          })}
        </div>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value.slice(0, 400))}
          rows={2}
          maxLength={400}
          placeholder="Any special instructions? (e.g. gate code, floor number)"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none resize-none"
        />
        <p className="text-[10px] text-slate-400 mt-1 text-right">
          {notes.length}/400
        </p>
      </div>

      {/* ─── Bill breakdown ───────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 border-b border-slate-100 hover:bg-slate-50"
        >
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-slate-500" />
            <span className="text-xs font-black text-slate-900">Bill details</span>
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </button>

        {expanded && (
          <div className="px-4 py-3 space-y-2 text-xs">
            <Row label="Item total" value={`₹${bill.subtotal}`} />
            <Row
              label={
                <span className="flex items-center gap-1">
                  Delivery fee
                  <Info className="h-3 w-3 text-slate-300" />
                </span>
              }
              value={
                bill.deliveryFee === 0 ? (
                  <span>
                    <span className="text-slate-400 line-through mr-1">₹19</span>
                    <span className="text-emerald-700 font-black">FREE</span>
                  </span>
                ) : (
                  `₹${bill.deliveryFee}`
                )
              }
            />
            <Row
              label={
                <span className="flex items-center gap-1">
                  Handling fee
                  <Info className="h-3 w-3 text-slate-300" />
                </span>
              }
              value={bill.handlingFee === 0 ? "FREE" : `₹${bill.handlingFee}`}
              muted={bill.handlingFee === 0}
            />
            {bill.discount > 0 && (
              <Row
                label={
                  <span className="text-emerald-700">
                    Discount {bill.couponCode && `(${bill.couponCode})`}
                  </span>
                }
                value={<span className="text-emerald-700">−₹{bill.discount}</span>}
              />
            )}
            {tip > 0 && (
              <Row label="Tip for delivery partner" value={`₹${tip}`} />
            )}
            <div className="pt-2 mt-1 border-t border-dashed border-slate-200 flex items-center justify-between">
              <span className="text-sm font-black text-slate-900">To pay</span>
              <span className="text-sm font-black text-slate-900">₹{total}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  muted,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? "text-slate-400" : "text-slate-600"}>{label}</span>
      <span className={`font-bold ${muted ? "text-slate-400" : "text-slate-900"}`}>
        {value}
      </span>
    </div>
  );
}
