"use client";

import { useEffect, useState } from "react";
import {
  Sliders,
  MapPin,
  Zap,
  Save,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react";

/**
 * Owner-facing screen for the two things a single-store operator actually
 * changes day-to-day:
 *
 *   1. The delivery radius (3 km today, 5 km when demand or staffing changes)
 *      + the store centre lat/lng and the ETA the customer sees.
 *   2. Fees and the free-delivery threshold. Historically hardcoded on the
 *      server; now backed by StoreSetting so a save actually changes the
 *      order-total on the next checkout.
 *
 * We PUT to /api/store-settings — same route the polygon drawer uses — so
 * everything geofence-related lives on a single row (the "singleton"
 * StoreSetting). Fees are surfaced here for edit UX but the server-side
 * pricing wiring lands with the P1 fee-migration.
 */

interface StoreSettingsResponse {
  storeLat: number | null;
  storeLng: number | null;
  deliveryRadiusKm: number | null;
  etaMinutesOverride: number | null;
  isOpen: boolean;
  closedMessage: string | null;
  // Fees are stored as paise on the server, edited as rupees here.
  deliveryFeeDefault: number;
  freeAboveThreshold: number;
  handlingFeeDefault: number;
}

// Server-side defaults (rupees) — shown until the settings row loads.
const DEFAULT_FLAT_FEE = 19;
const DEFAULT_FREE_ABOVE = 199;
const DEFAULT_HANDLING_FEE = 2;

// paise ↔ rupees: server stores integer paise everywhere, form works in rupees.
const paiseToRupees = (p: number) => Math.round(p) / 100;
const rupeesToPaise = (r: number) => Math.round(r * 100);

export default function DeliveryRulesView() {
  // Geofence — the real, saveable state.
  const [radiusKm, setRadiusKm] = useState<number>(3);
  const [storeLat, setStoreLat] = useState<number | "">("");
  const [storeLng, setStoreLng] = useState<number | "">("");
  const [etaMinutes, setEtaMinutes] = useState<number | "">("");

  // Pricing — now real, saveable state backed by StoreSetting.
  const [flatFee, setFlatFee] = useState(DEFAULT_FLAT_FEE);
  const [freeThreshold, setFreeThreshold] = useState(DEFAULT_FREE_ABOVE);
  const [handlingFee, setHandlingFee] = useState(DEFAULT_HANDLING_FEE);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savingPricing, setSavingPricing] = useState(false);
  const [savedPricing, setSavedPricing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load current settings on mount so the form reflects reality.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/store-settings", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as StoreSettingsResponse;
        if (cancelled) return;
        if (data.deliveryRadiusKm != null) setRadiusKm(data.deliveryRadiusKm);
        if (data.storeLat != null) setStoreLat(data.storeLat);
        if (data.storeLng != null) setStoreLng(data.storeLng);
        if (data.etaMinutesOverride != null) setEtaMinutes(data.etaMinutesOverride);
        if (typeof data.deliveryFeeDefault === "number") {
          setFlatFee(paiseToRupees(data.deliveryFeeDefault));
        }
        if (typeof data.freeAboveThreshold === "number") {
          setFreeThreshold(paiseToRupees(data.freeAboveThreshold));
        }
        if (typeof data.handlingFeeDefault === "number") {
          setHandlingFee(paiseToRupees(data.handlingFeeDefault));
        }
      } catch (err) {
        if (!cancelled) {
          setError("Could not load current settings. Editing will use defaults.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSaveGeofence = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      // Only send the fields the owner actually touched — sending `null` for
      // an unchanged lat/lng would wipe it back to env defaults, which is
      // rarely what the operator wants from this screen.
      const patch: Record<string, unknown> = { deliveryRadiusKm: radiusKm };
      if (storeLat !== "") patch.storeLat = Number(storeLat);
      if (storeLng !== "") patch.storeLng = Number(storeLng);
      if (etaMinutes !== "") patch.etaMinutesOverride = Number(etaMinutes);

      const res = await fetch("/api/store-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSavePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSavingPricing(true);
    try {
      const res = await fetch("/api/store-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          deliveryFeeDefault: rupeesToPaise(flatFee),
          freeAboveThreshold: rupeesToPaise(freeThreshold),
          handlingFeeDefault: rupeesToPaise(handlingFee),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      setSavedPricing(true);
      setTimeout(() => setSavedPricing(false), 2500);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setSavingPricing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black tracking-tight text-slate-100">
          Delivery Rules & Geofencing Configuration
        </h2>
        <p className="text-xs text-slate-400">
          Set the delivery radius, store pin, and delivery-time promise. Changes
          take effect immediately — the storefront picks them up on the next
          serviceability check.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-rose-950 p-3 text-xs font-bold text-rose-300 border border-rose-800">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Geofence form — the real, saveable one */}
        <form
          onSubmit={handleSaveGeofence}
          className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-xl"
        >
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <MapPin className="h-5 w-5 text-emerald-400" />
            <h3 className="text-sm font-extrabold text-white">Delivery Zone</h3>
            <span className="ml-auto flex items-center gap-1 rounded-full bg-emerald-950 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-800">
              <Zap className="h-3 w-3" /> {radiusKm} km active
            </span>
          </div>

          {saved && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-950 p-3 text-xs font-bold text-emerald-400 border border-emerald-800">
              <CheckCircle2 className="h-4 w-4" /> Delivery zone updated.
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Delivery Radius (km)
            </label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              max="50"
              value={radiusKm}
              onChange={(e) => setRadiusKm(parseFloat(e.target.value) || 0)}
              disabled={loading || saving}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none disabled:opacity-60"
            />
            <p className="mt-1 text-[10px] text-slate-500">
              Change from 3 km to 5 km (or anything between 0.1 and 50) without
              a redeploy.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Store Latitude
              </label>
              <input
                type="number"
                step="0.000001"
                value={storeLat}
                placeholder="20.287687"
                onChange={(e) =>
                  setStoreLat(e.target.value === "" ? "" : parseFloat(e.target.value))
                }
                disabled={loading || saving}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Store Longitude
              </label>
              <input
                type="number"
                step="0.000001"
                value={storeLng}
                placeholder="86.609112"
                onChange={(e) =>
                  setStoreLng(e.target.value === "" ? "" : parseFloat(e.target.value))
                }
                disabled={loading || saving}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none disabled:opacity-60"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Promised ETA (minutes)
            </label>
            <input
              type="number"
              min="0"
              max="240"
              value={etaMinutes}
              placeholder="10"
              onChange={(e) =>
                setEtaMinutes(e.target.value === "" ? "" : parseInt(e.target.value, 10))
              }
              disabled={loading || saving}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none disabled:opacity-60"
            />
            <p className="mt-1 text-[10px] text-slate-500">
              Leave blank to use the default (10 min). Bump temporarily on busy
              days.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || saving}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              <>
                <Save className="h-4 w-4" /> Save Delivery Zone
              </>
            )}
          </button>
        </form>

        {/* Pricing form — editable, backed by StoreSetting */}
        <form
          onSubmit={handleSavePricing}
          className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-xl"
        >
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Sliders className="h-5 w-5 text-amber-400" />
            <h3 className="text-sm font-extrabold text-white">Pricing Rules</h3>
          </div>

          {savedPricing && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-950 p-3 text-xs font-bold text-emerald-400 border border-emerald-800">
              <CheckCircle2 className="h-4 w-4" /> Pricing updated.
            </div>
          )}

          <p className="text-[11px] text-slate-400 leading-relaxed">
            All prices in rupees. Delivery and handling fees are waived when
            the customer's subtotal crosses the free-delivery threshold.
          </p>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Flat Delivery Fee (₹)
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={flatFee}
              onChange={(e) => setFlatFee(parseInt(e.target.value) || 0)}
              disabled={loading || savingPricing}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Free Delivery Threshold (₹)
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={freeThreshold}
              onChange={(e) => setFreeThreshold(parseInt(e.target.value) || 0)}
              disabled={loading || savingPricing}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Handling Fee (₹)
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={handlingFee}
              onChange={(e) => setHandlingFee(parseInt(e.target.value) || 0)}
              disabled={loading || savingPricing}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none disabled:opacity-60"
            />
          </div>

          <button
            type="submit"
            disabled={loading || savingPricing}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 text-xs font-extrabold text-slate-950 hover:bg-amber-400 disabled:opacity-60"
          >
            {savingPricing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              <>
                <Save className="h-4 w-4" /> Save Pricing Rules
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
