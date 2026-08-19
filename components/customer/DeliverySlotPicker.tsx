"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, CalendarClock, Zap, Loader2, AlertCircle } from "lucide-react";

/**
 * Blinkit-style delivery-slot picker.
 *
 * Fetches upcoming slots from /api/delivery-slots and lets the customer
 * either pick "Deliver now" (instant) or a specific window. Groups slots
 * by day. Sold-out / past-lead-time slots are shown but disabled.
 *
 * Value contract:
 *   - `value === null` → instant delivery
 *   - `value === "2025-11-05T17:00:00.000Z"` → scheduled slot start
 */

interface Slot {
  start: string; // ISO
  end: string;
  label: string;
  remaining: number;
  soldOut: boolean;
}

interface SlotResponse {
  success: boolean;
  enabled: boolean;
  slotDurationMinutes?: number;
  slots?: Slot[];
  message?: string;
}

interface DeliverySlotPickerProps {
  value: string | null; // ISO or null (instant)
  onChange: (iso: string | null) => void;
  /** Instant ETA string to display on the "Deliver now" tile (e.g. "10 min"). */
  instantEta?: string;
  className?: string;
}

const dayLabel = (d: Date, todayKey: string) => {
  const key = d.toDateString();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (key === todayKey) return "Today";
  if (key === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
};

export default function DeliverySlotPicker({
  value,
  onChange,
  instantEta = "10 min",
  className,
}: DeliverySlotPickerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/delivery-slots?hours=48", { credentials: "include" });
        const data: SlotResponse = await res.json();
        if (cancelled) return;
        if (!data.success) throw new Error(data.message || "Failed to load slots");
        setEnabled(!!data.enabled);
        setSlots(data.slots ?? []);
      } catch (err: any) {
        if (!cancelled) setError(err.message ?? "Failed to load slots");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Group slots by calendar day for a clean grid layout
  const grouped = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots) {
      const day = new Date(s.start).toDateString();
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(s);
    }
    return Array.from(map.entries());
  }, [slots]);

  // Don't render at all when the feature isn't enabled — customer just gets
  // instant delivery like before.
  if (!loading && !enabled) return null;

  const todayKey = new Date().toDateString();

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-4 space-y-3 ${className ?? ""}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-purple-600" />
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
            Delivery time
          </h3>
        </div>
        {loading && <Loader2 className="h-3.5 w-3.5 text-slate-400 animate-spin" />}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-[11px] text-rose-800">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Instant */}
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`w-full flex items-center justify-between rounded-2xl border p-3 text-left transition-all ${
          value === null
            ? "border-emerald-600 bg-emerald-50 shadow-xs"
            : "border-slate-200 hover:border-slate-300"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-black text-slate-900">Deliver now</p>
            <p className="text-[11px] text-slate-500">Arriving in ~{instantEta}</p>
          </div>
        </div>
        <input
          type="radio"
          checked={value === null}
          onChange={() => onChange(null)}
          className="h-4 w-4 accent-emerald-600 pointer-events-none"
        />
      </button>

      {/* Grouped slot chips */}
      {enabled && grouped.length > 0 && (
        <div className="space-y-3 pt-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Or schedule for later
          </div>
          {grouped.map(([dayKey, daySlots]) => (
            <div key={dayKey}>
              <p className="text-[11px] font-black text-slate-700 mb-1.5">
                {dayLabel(new Date(dayKey), todayKey)}
              </p>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {daySlots.map((s) => {
                  const active = value === s.start;
                  return (
                    <button
                      key={s.start}
                      type="button"
                      onClick={() => onChange(s.start)}
                      disabled={s.soldOut}
                      className={`rounded-xl border px-2.5 py-1.5 text-[11px] font-bold transition-all text-left ${
                        s.soldOut
                          ? "border-slate-100 bg-slate-50 text-slate-300 line-through cursor-not-allowed"
                          : active
                            ? "border-purple-600 bg-purple-50 text-purple-800"
                            : "border-slate-200 text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 flex-shrink-0" />
                        <span>{s.label}</span>
                      </div>
                      {!s.soldOut && s.remaining <= 3 && (
                        <span className="block text-[9px] font-black text-amber-600 mt-0.5">
                          Only {s.remaining} left
                        </span>
                      )}
                      {s.soldOut && (
                        <span className="block text-[9px] font-black text-slate-400 mt-0.5">
                          Full
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {enabled && !loading && grouped.length === 0 && (
        <p className="text-[11px] text-slate-500 text-center py-2">
          No scheduled slots available right now.
        </p>
      )}
    </div>
  );
}
