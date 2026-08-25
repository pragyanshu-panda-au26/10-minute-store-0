"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { CATEGORIES } from "@/lib/dummyData";
import {
  Menu,
  Power,
  Clock,
  MapPin,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Compass,
  Timer,
  Pencil,
  Trash2,
  CalendarClock,
} from "lucide-react";

// Leaflet needs the browser — must not run at SSR
const DeliveryPolygonDrawer = dynamic(
  () => import("@/components/admin/DeliveryPolygonDrawer"),
  {
    ssr: false,
    loading: () => (
      <div className="h-72 w-full flex items-center justify-center rounded-2xl border border-slate-800 bg-slate-950 text-slate-500 text-xs gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading map…
      </div>
    ),
  }
);

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface DayHours { open: string; close: string; closed?: boolean }
type WeeklyHours = Record<string, DayHours>;

interface Settings {
  isOpen: boolean;
  closedMessage: string | null;
  weeklyHours: WeeklyHours;
  etaMinutesOverride: number | null;
  storeLat: number | null;
  storeLng: number | null;
  deliveryRadiusKm: number | null;
  deliveryPolygon: [number, number][] | null;
  slotEnabled: boolean;
  slotDurationMinutes: number;
  slotCapacity: number;
  slotLeadMinutes: number;
  /** Rotating storefront search-bar placeholders. */
  searchPlaceholders: string[];
  /** Admin-curated merchandising pins per L2 category. */
  featuredByCategory: Record<string, string[]>;
  open?: boolean;
  reason?: string | null;
}

const DEFAULT_HOURS: WeeklyHours = {
  "0": { open: "09:00", close: "22:00" },
  "1": { open: "09:00", close: "22:00" },
  "2": { open: "09:00", close: "22:00" },
  "3": { open: "09:00", close: "22:00" },
  "4": { open: "09:00", close: "22:00" },
  "5": { open: "09:00", close: "22:00" },
  "6": { open: "09:00", close: "22:00" },
};

export default function AdminSettingsPage() {
  const [isOpenMobile, setIsOpenMobile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [s, setS] = useState<Settings | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/store-settings", { credentials: "include" });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setS({
        isOpen: data.isOpen,
        closedMessage: data.closedMessage,
        weeklyHours: (data.weeklyHours && Object.keys(data.weeklyHours).length > 0)
          ? data.weeklyHours
          : DEFAULT_HOURS,
        etaMinutesOverride: data.etaMinutesOverride,
        storeLat: data.storeLat,
        storeLng: data.storeLng,
        deliveryRadiusKm: data.deliveryRadiusKm,
        deliveryPolygon: data.deliveryPolygon ?? null,
        slotEnabled: data.slotEnabled ?? false,
        slotDurationMinutes: data.slotDurationMinutes ?? 60,
        slotCapacity: data.slotCapacity ?? 20,
        slotLeadMinutes: data.slotLeadMinutes ?? 30,
        searchPlaceholders: Array.isArray(data.searchPlaceholders)
          ? data.searchPlaceholders
          : [],
        featuredByCategory:
          data.featuredByCategory && typeof data.featuredByCategory === "object"
            ? (data.featuredByCategory as Record<string, string[]>)
            : {},
        open: data.open,
        reason: data.closed_reason,
      });
    } catch (err: any) {
      setToast({ tone: "err", text: err.message ?? "Failed to load settings" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async (patch: Partial<Settings>) => {
    if (!s) return;
    setSaving(true);
    try {
      const res = await fetch("/api/store-settings", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setS((prev) => (prev ? { ...prev, ...data } : prev));
      setToast({ tone: "ok", text: "Saved." });
      setTimeout(() => setToast(null), 2200);
    } catch (err: any) {
      setToast({ tone: "err", text: err.message ?? "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  const updateHour = (day: string, field: "open" | "close" | "closed", val: any) => {
    if (!s) return;
    setS({
      ...s,
      weeklyHours: {
        ...s.weeklyHours,
        [day]: { ...s.weeklyHours[day], [field]: val },
      },
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <AdminSidebar
        activeTab={"settings" as any}
        setActiveTab={() => {}}
        pendingOrdersCount={0}
        lowStockCount={0}
        isOpenMobile={isOpenMobile}
        setIsOpenMobile={setIsOpenMobile}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-800 bg-slate-950/90 px-5 py-3.5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsOpenMobile(true)}
              className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-400 md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-base font-black text-white">Store settings</h1>
          </div>
          {toast && (
            <span
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold ${
                toast.tone === "ok"
                  ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                  : "bg-rose-950 text-rose-300 border border-rose-800"
              }`}
            >
              {toast.tone === "ok" ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
              {toast.text}
            </span>
          )}
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-3xl w-full mx-auto space-y-6">
          {loading && (
            <div className="text-slate-400 text-xs flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          )}

          {s && (
            <>
              {/* ─── Open / close master switch ─────────── */}
              <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                        s.isOpen ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                      }`}
                    >
                      <Power className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-black text-white">
                        Store is {s.isOpen ? "OPEN" : "CLOSED"}
                      </h2>
                      <p className="text-[11px] text-slate-400">
                        {s.open === false
                          ? s.reason || "Currently closed — customers can't place orders."
                          : "Accepting new orders right now."}
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={s.isOpen}
                      disabled={saving}
                      onChange={(e) => save({ isOpen: e.target.checked })}
                    />
                    <div className="w-14 h-7 bg-slate-700 rounded-full peer peer-checked:bg-emerald-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:after:translate-x-7" />
                  </label>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Closed message (shown to customers)
                  </label>
                  <input
                    type="text"
                    value={s.closedMessage ?? ""}
                    onChange={(e) => setS({ ...s, closedMessage: e.target.value })}
                    onBlur={() => save({ closedMessage: s.closedMessage || null })}
                    maxLength={200}
                    placeholder="e.g. Back at 9 AM tomorrow!"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 px-3 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </section>

              {/* ─── Business hours grid ────────────────── */}
              <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-emerald-400" />
                  <h2 className="text-sm font-black text-white">Business hours</h2>
                </div>
                <div className="space-y-2">
                  {DAY_LABELS.map((label, idx) => {
                    const key = String(idx);
                    const hours = s.weeklyHours[key] ?? { open: "09:00", close: "22:00" };
                    return (
                      <div
                        key={key}
                        className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2"
                      >
                        <span className="w-10 text-xs font-black text-slate-300">{label}</span>
                        <label className="flex items-center gap-1.5 text-[10px] text-slate-400">
                          <input
                            type="checkbox"
                            checked={hours.closed ?? false}
                            onChange={(e) => updateHour(key, "closed", e.target.checked)}
                            className="h-3.5 w-3.5 accent-rose-600"
                          />
                          Closed
                        </label>
                        <input
                          type="time"
                          value={hours.open}
                          disabled={hours.closed}
                          onChange={(e) => updateHour(key, "open", e.target.value)}
                          className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-white disabled:opacity-40"
                        />
                        <span className="text-slate-500 text-xs">→</span>
                        <input
                          type="time"
                          value={hours.close}
                          disabled={hours.closed}
                          onChange={(e) => updateHour(key, "close", e.target.value)}
                          className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-white disabled:opacity-40"
                        />
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={() => save({ weeklyHours: s.weeklyHours })}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-extrabold text-white shadow disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save hours
                </button>
              </section>

              {/* ─── ETA override ─────────────────────── */}
              <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Timer className="h-4 w-4 text-amber-400" />
                  <h2 className="text-sm font-black text-white">Delivery ETA override</h2>
                </div>
                <p className="text-[11px] text-slate-400">
                  Temporarily bump the promise ("we're busy, add 5 min today"). Leave blank to use the default.
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={0}
                    max={240}
                    value={s.etaMinutesOverride ?? ""}
                    onChange={(e) =>
                      setS({
                        ...s,
                        etaMinutesOverride: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    placeholder="10"
                    className="w-24 rounded-xl border border-slate-800 bg-slate-950 py-2 px-3 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  />
                  <span className="text-xs text-slate-400">minutes</span>
                  <button
                    onClick={() => save({ etaMinutesOverride: s.etaMinutesOverride })}
                    disabled={saving}
                    className="ml-auto rounded-xl bg-slate-800 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700 disabled:opacity-60"
                  >
                    Apply
                  </button>
                </div>
              </section>

              {/* ─── Live geofence ───────────────────── */}
              <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Compass className="h-4 w-4 text-blue-400" />
                  <h2 className="text-sm font-black text-white">Delivery zone (live)</h2>
                </div>
                <p className="text-[11px] text-slate-400">
                  Adjust radius or move the store pin without redeploying. Blank = fall back to env defaults.
                </p>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Store lat
                    </label>
                    <input
                      type="number"
                      step="0.000001"
                      value={s.storeLat ?? ""}
                      onChange={(e) =>
                        setS({ ...s, storeLat: e.target.value === "" ? null : Number(e.target.value) })
                      }
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2 px-3 text-xs font-mono text-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Store lng
                    </label>
                    <input
                      type="number"
                      step="0.000001"
                      value={s.storeLng ?? ""}
                      onChange={(e) =>
                        setS({ ...s, storeLng: e.target.value === "" ? null : Number(e.target.value) })
                      }
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2 px-3 text-xs font-mono text-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Radius (km)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="50"
                      value={s.deliveryRadiusKm ?? ""}
                      onChange={(e) =>
                        setS({
                          ...s,
                          deliveryRadiusKm: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2 px-3 text-xs font-mono text-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {[1, 2, 3, 5, 10].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setS({ ...s, deliveryRadiusKm: r })}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold border ${
                        s.deliveryRadiusKm === r
                          ? "border-blue-500 bg-blue-950 text-blue-300"
                          : "border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600"
                      }`}
                    >
                      {r} km
                    </button>
                  ))}
                </div>

                <button
                  onClick={() =>
                    save({
                      storeLat: s.storeLat,
                      storeLng: s.storeLng,
                      deliveryRadiusKm: s.deliveryRadiusKm,
                    })
                  }
                  disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-extrabold text-white shadow disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5" />}
                  Save zone
                </button>

                {(s.storeLat || s.storeLng) && (
                  <p className="text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-800">
                    Effective: {s.storeLat ?? "env"}, {s.storeLng ?? "env"} · r={s.deliveryRadiusKm ?? "env"} km
                  </p>
                )}
              </section>

              {/* ─── Custom polygon zone ───────────────── */}
              <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Pencil className="h-4 w-4 text-emerald-400" />
                    <h2 className="text-sm font-black text-white">Custom delivery polygon</h2>
                  </div>
                  {s.deliveryPolygon && s.deliveryPolygon.length >= 3 && (
                    <span className="rounded-full bg-emerald-950 px-2 py-0.5 text-[10px] font-black text-emerald-300 border border-emerald-800">
                      {s.deliveryPolygon.length} vertices · active
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  Click on the map to add vertices. Drag a vertex handle to reshape,
                  or <strong>right-click</strong> a vertex to remove it. When a polygon is saved with
                  ≥3 vertices, it <strong>wins over</strong> the circular radius above.
                  Grey circle = the current radius fallback.
                </p>

                <DeliveryPolygonDrawer
                  polygon={s.deliveryPolygon ?? []}
                  onChange={(next) => setS({ ...s, deliveryPolygon: next.length >= 3 ? next : null })}
                  center={{
                    lat: s.storeLat ?? 20.2876869,
                    lng: s.storeLng ?? 86.6091121,
                  }}
                  radiusKm={s.deliveryRadiusKm ?? 3}
                />

                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      save({ deliveryPolygon: (s.deliveryPolygon?.length ?? 0) >= 3 ? s.deliveryPolygon : null })
                    }
                    disabled={saving}
                    className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-extrabold text-white shadow disabled:opacity-60"
                  >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Save polygon
                  </button>
                  <button
                    onClick={() => {
                      if (!confirm("Clear the drawn polygon and fall back to the circular radius?")) return;
                      setS({ ...s, deliveryPolygon: null });
                      save({ deliveryPolygon: null });
                    }}
                    disabled={saving || !s.deliveryPolygon || s.deliveryPolygon.length === 0}
                    className="flex items-center gap-2 rounded-xl border border-rose-800 bg-rose-950/40 px-3 py-2 text-xs font-extrabold text-rose-300 hover:bg-rose-900/60 disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Clear polygon
                  </button>
                </div>
              </section>

              {/* ─── Slot-based delivery ───────────────── */}
              <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-purple-400" />
                    <h2 className="text-sm font-black text-white">Slot-based delivery</h2>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={s.slotEnabled}
                      disabled={saving}
                      onChange={(e) => save({ slotEnabled: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-slate-700 rounded-full peer peer-checked:bg-purple-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
                  </label>
                </div>
                <p className="text-[11px] text-slate-400">
                  When enabled, customers see a slot picker at checkout in addition to instant delivery.
                  Each slot is capped so you don't overload yourself.
                </p>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Slot length (min)
                    </label>
                    <select
                      value={s.slotDurationMinutes}
                      onChange={(e) => setS({ ...s, slotDurationMinutes: Number(e.target.value) })}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2 px-3 text-xs text-white focus:border-purple-500 focus:outline-none"
                    >
                      {[15, 30, 45, 60, 90, 120].map((n) => (
                        <option key={n} value={n}>{n} min</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Capacity / slot
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      value={s.slotCapacity}
                      onChange={(e) => setS({ ...s, slotCapacity: Number(e.target.value) })}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2 px-3 text-xs font-mono text-white focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Lead time (min)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={720}
                      value={s.slotLeadMinutes}
                      onChange={(e) => setS({ ...s, slotLeadMinutes: Number(e.target.value) })}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2 px-3 text-xs font-mono text-white focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  onClick={() =>
                    save({
                      slotDurationMinutes: s.slotDurationMinutes,
                      slotCapacity: s.slotCapacity,
                      slotLeadMinutes: s.slotLeadMinutes,
                    })
                  }
                  disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-xs font-extrabold text-white shadow disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save slot config
                </button>
              </section>

              {/* ─── Storefront search suggestions ───────────────────
                  Rotating placeholder chips shown in the storefront header
                  search bar. Cycle every ~3s on the customer side. Server
                  dedupes + caps at 12; we cap the input at 12 too so the
                  admin sees the same limit. */}
              <SearchPlaceholderEditor
                value={s.searchPlaceholders}
                onChange={(next) => setS({ ...s, searchPlaceholders: next })}
                onSave={() => save({ searchPlaceholders: s.searchPlaceholders })}
                saving={saving}
              />

              {/* ─── Merchandising pins per category ─────────────────
                  Pinned products lead the PDP "Top in this category" rail
                  before the algorithmic sort. Server caps at 12 per L2. */}
              <MerchandisingPinsEditor
                value={s.featuredByCategory}
                onChange={(next) => setS({ ...s, featuredByCategory: next })}
                onSave={() =>
                  save({ featuredByCategory: s.featuredByCategory })
                }
                saving={saving}
              />
            </>
          )}
        </main>
      </div>
    </div>
  );
}

/**
 * Chip editor for the storefront search-bar rotating placeholders.
 * Feeds StoreSetting.searchPlaceholders — server dedupes + caps at 12, so we
 * cap the input at 12 too for a matching visual.
 */
function SearchPlaceholderEditor({
  value,
  onChange,
  onSave,
  saving,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const [draft, setDraft] = useState("");
  const CAP = 12;

  const add = () => {
    const clean = draft.trim();
    if (!clean) return;
    if (value.includes(clean)) {
      setDraft("");
      return;
    }
    if (value.length >= CAP) return;
    onChange([...value, clean]);
    setDraft("");
  };

  const remove = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5 space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
          <Compass className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-black text-white">Search suggestions</h2>
          <p className="text-[11px] text-slate-400">
            Words that cycle in the storefront search bar placeholder. Max {CAP}.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {value.length === 0 && (
          <p className="text-[11px] text-slate-500">
            No suggestions yet. Add a few (e.g. <em>bread</em>, <em>milk</em>,
            <em> eggs</em>) so the search bar feels alive.
          </p>
        )}
        {value.map((chip, idx) => (
          <span
            key={`${chip}-${idx}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 pl-3 pr-1 py-1 text-[11px] font-bold text-amber-300"
          >
            {chip}
            <button
              type="button"
              onClick={() => remove(idx)}
              aria-label={`Remove ${chip}`}
              className="flex h-5 w-5 items-center justify-center rounded-full text-amber-300 hover:bg-amber-500/20 hover:text-amber-100 cursor-pointer"
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          maxLength={40}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder='e.g. "chocolate"'
          disabled={value.length >= CAP}
          className="flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim() || value.length >= CAP}
          className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-black text-slate-950 hover:bg-amber-400 disabled:opacity-40 cursor-pointer"
        >
          + Add
        </button>
      </div>

      <button
        onClick={onSave}
        disabled={saving}
        className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-extrabold text-slate-950 shadow disabled:opacity-60 cursor-pointer"
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        Save search suggestions
      </button>
    </section>
  );
}

/**
 * Per-category merchandising pinner. Feeds StoreSetting.featuredByCategory.
 *
 * UX: one card per L1 category (loaded from CATEGORIES). Each card shows
 * the current pins as chips (with × to remove) and a dropdown to add a
 * product from that category's inventory. Server dedupes + caps at 12
 * pins per category, mirrored client-side so the admin sees the same limit.
 *
 * Products are fetched lazily on mount; loading state hides the pinner.
 */
function MerchandisingPinsEditor({
  value,
  onChange,
  onSave,
  saving,
}: {
  value: Record<string, string[]>;
  onChange: (next: Record<string, string[]>) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const CAP = 12;
  const [products, setProducts] = useState<
    { id: string; name: string; category: string; imageUrl?: string }[]
  >([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/products?includeInactive=true", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (!d.success) throw new Error(d.message);
        setProducts(
          (d.products ?? []).map((p: any) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            imageUrl: p.imageUrl,
          }))
        );
      })
      .catch((e) => !cancelled && setError(e.message ?? "Load failed"))
      .finally(() => !cancelled && setLoadingProducts(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const productsByCategory = new Map<string, typeof products>();
  for (const p of products) {
    const arr = productsByCategory.get(p.category) ?? [];
    arr.push(p);
    productsByCategory.set(p.category, arr);
  }

  const nameOf = (id: string) =>
    products.find((p) => p.id === id)?.name ?? id;

  const addPin = (catId: string, pid: string) => {
    if (!pid) return;
    const current = value[catId] ?? [];
    if (current.includes(pid)) return;
    if (current.length >= CAP) return;
    onChange({ ...value, [catId]: [...current, pid] });
  };
  const removePin = (catId: string, pid: string) => {
    const current = value[catId] ?? [];
    const next = current.filter((x) => x !== pid);
    const clone = { ...value };
    if (next.length === 0) delete clone[catId];
    else clone[catId] = next;
    onChange(clone);
  };
  const clearAll = () => onChange({});

  return (
    <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-white flex items-center gap-2">
            <Pencil className="h-4 w-4 text-cyan-400" />
            Merchandising pins
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Pinned products lead the PDP "Top in this category" rail before the
            algorithmic sort. Max {CAP} per category.
          </p>
        </div>
        <div className="flex gap-2">
          {Object.keys(value).length > 0 && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1 rounded-xl border border-rose-500/40 bg-rose-950/50 px-3 py-1.5 text-[11px] font-bold text-rose-300 hover:bg-rose-950 cursor-pointer"
            >
              <Trash2 className="h-3 w-3" /> Clear all
            </button>
          )}
          <button
            onClick={onSave}
            disabled={saving || loadingProducts}
            className="flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-xs font-extrabold text-white shadow disabled:opacity-60 cursor-pointer"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save pins
          </button>
        </div>
      </div>

      {loadingProducts && (
        <div className="text-xs text-slate-500 flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading products…
        </div>
      )}
      {error && (
        <div className="text-xs text-rose-400">
          {error}
        </div>
      )}

      {!loadingProducts && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {CATEGORIES.filter((c) => c.id !== "all").map((cat) => {
            const pins = value[cat.id] ?? [];
            const availableProducts = (productsByCategory.get(cat.id) ?? []).filter(
              (p) => !pins.includes(p.id)
            );
            return (
              <div
                key={cat.id}
                className="rounded-xl border border-slate-800 bg-slate-900 p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-black text-white flex items-center gap-1.5">
                    <span>{cat.icon}</span>
                    {cat.name}
                  </p>
                  <span className="text-[10px] font-bold text-slate-500">
                    {pins.length}/{CAP}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 min-h-[24px]">
                  {pins.length === 0 && (
                    <span className="text-[10px] text-slate-500">
                      No pins — algorithmic sort only.
                    </span>
                  )}
                  {pins.map((pid, i) => (
                    <span
                      key={pid}
                      className="inline-flex items-center gap-1 rounded-full border border-cyan-500/40 bg-cyan-950/60 px-2 py-0.5 text-[10px] font-bold text-cyan-200"
                    >
                      <span className="text-cyan-400">#{i + 1}</span>
                      <span className="truncate max-w-[120px]">{nameOf(pid)}</span>
                      <button
                        type="button"
                        onClick={() => removePin(cat.id, pid)}
                        className="text-cyan-400 hover:text-rose-300 cursor-pointer"
                        aria-label={`Remove ${nameOf(pid)} from ${cat.name} pins`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                {availableProducts.length > 0 && pins.length < CAP && (
                  <select
                    value=""
                    onChange={(e) => {
                      addPin(cat.id, e.target.value);
                      e.currentTarget.value = "";
                    }}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-1.5 text-[11px] text-slate-300 focus:border-cyan-500 focus:outline-none cursor-pointer"
                  >
                    <option value="">Pin a product…</option>
                    {availableProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}
                {availableProducts.length === 0 && pins.length > 0 && (
                  <p className="text-[10px] text-slate-500">
                    All products in this category are pinned.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
