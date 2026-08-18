"use client";

import { useState } from "react";
import { Sliders, MapPin, Zap, Save, CheckCircle2 } from "lucide-react";

export default function DeliveryRulesView() {
  const [flatFee, setFlatFee] = useState(25);
  const [freeThreshold, setFreeThreshold] = useState(199);
  const [handlingFee, setHandlingFee] = useState(5);
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black tracking-tight text-slate-100">
          Delivery Rules & Geofencing Configuration
        </h2>
        <p className="text-xs text-slate-400">
          Configure dynamic delivery pricing, free shipping threshold, and dark store delivery radius
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Delivery Fee Settings Form */}
        <form onSubmit={handleSave} className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-xl">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Sliders className="h-5 w-5 text-emerald-400" />
            <h3 className="text-sm font-extrabold text-white">Dynamic Pricing Rules</h3>
          </div>

          {saved && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-950 p-3 text-xs font-bold text-emerald-400 border border-emerald-800">
              <CheckCircle2 className="h-4 w-4" /> Delivery rules updated successfully!
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Flat Delivery Fee (₹)
            </label>
            <input
              type="number"
              value={flatFee}
              onChange={(e) => setFlatFee(parseInt(e.target.value) || 0)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Free Delivery Threshold (₹)
            </label>
            <input
              type="number"
              value={freeThreshold}
              onChange={(e) => setFreeThreshold(parseInt(e.target.value) || 0)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Platform Handling Fee (₹)
            </label>
            <input
              type="number"
              value={handlingFee}
              onChange={(e) => setHandlingFee(parseInt(e.target.value) || 0)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-xs font-extrabold text-slate-950 hover:bg-emerald-400"
          >
            <Save className="h-4 w-4" /> Save Pricing Rules
          </button>
        </form>

        {/* Geofencing Polygon Map Config */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-3 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-rose-400" />
              <h3 className="text-sm font-extrabold text-white">Geofenced Service Zone</h3>
            </div>
            <span className="flex items-center gap-1 rounded-full bg-emerald-950 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-800">
              <Zap className="h-3 w-3" /> 2.5 KM Radius Active
            </span>
          </div>

          <div className="relative h-48 w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />
            <div className="absolute inset-8 rounded-full border-2 border-dashed border-emerald-500/50 bg-emerald-500/10 flex items-center justify-center">
              <span className="text-xs font-bold text-emerald-400 bg-slate-950 px-3 py-1 rounded-full border border-emerald-800">
                Dark Store #01 Polygon (Bhubaneswar Zone)
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Active pincodes: <strong className="text-slate-200">751024 (Patia), 751007 (Saheed Nagar), 751013 (Jaydev Vihar), 751019 (Dumduma)</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}
