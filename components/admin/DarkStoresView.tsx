"use client";

import { useState, useEffect } from "react";
import { DarkStore, INITIAL_DARK_STORES } from "@/lib/adminDummyData";
import {
  Building2,
  Plus,
  Edit2,
  Trash2,
  MapPin,
  CheckCircle2,
  Navigation,
  Phone,
  User,
  Shield,
  Zap,
  Locate,
  AlertTriangle,
  Layers,
  X,
  Search,
} from "lucide-react";

const PRESET_COORDINATES = [
  { name: "Patia KIIT Square", address: "Plot 45, KIIT Road, Patia, Bhubaneswar", pincode: "751024", lat: 20.2961, lng: 85.8245 },
  { name: "Infocity Tech Park", address: "Plot 112, Chandaka Industrial Estate", pincode: "751024", lat: 20.3587, lng: 85.8142 },
  { name: "Saheed Nagar Janpath", address: "Plot 88, Janpath Road, Saheed Nagar", pincode: "751007", lat: 20.2882, lng: 85.8421 },
  { name: "Jaydev Vihar Square", address: "Plot 12, Jaydev Vihar Sq, Bhubaneswar", pincode: "751013", lat: 20.3012, lng: 85.8285 },
  { name: "Cuttack Road Hub", address: "Plot 90, Rasulgarh Sq, Cuttack Road", pincode: "751010", lat: 20.2798, lng: 85.8592 },
  { name: "Old Town Heritage", address: "Plot 34, Lingaraj Temple Road, Old Town", pincode: "751002", lat: 20.2415, lng: 85.8341 },
];

export default function DarkStoresView() {
  const [stores, setStores] = useState<DarkStore[]>(INITIAL_DARK_STORES);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<DarkStore | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Form inputs state
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Bhubaneswar");
  const [pincode, setPincode] = useState("751024");
  const [lat, setLat] = useState("20.2961");
  const [lng, setLng] = useState("85.8245");
  const [coverageRadiusKm, setCoverageRadiusKm] = useState("5");
  const [status, setStatus] = useState<"active" | "inactive" | "maintenance">("active");
  const [managerName, setManagerName] = useState("");
  const [managerPhone, setManagerPhone] = useState("");

  // Fetch Dark Stores from API
  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    try {
      const res = await fetch("/api/dark-stores");
      const data = await res.json();
      if (data.success && data.darkStores) {
        setStores(data.darkStores);
      }
    } catch (e) {
      setStores(INITIAL_DARK_STORES);
    }
  };

  const openCreateModal = () => {
    setEditingStore(null);
    setCode(`DS-${Math.floor(100 + Math.random() * 900)}`);
    setName("");
    setAddress("");
    setCity("Bhubaneswar");
    setPincode("751024");
    setLat("20.2961");
    setLng("85.8245");
    setCoverageRadiusKm("5");
    setStatus("active");
    setManagerName("");
    setManagerPhone("");
    setIsModalOpen(true);
  };

  const openEditModal = (s: DarkStore) => {
    setEditingStore(s);
    setCode(s.code);
    setName(s.name);
    setAddress(s.address);
    setCity(s.city);
    setPincode(s.pincode);
    setLat(s.lat.toString());
    setLng(s.lng.toString());
    setCoverageRadiusKm(s.coverageRadiusKm.toString());
    setStatus(s.status);
    setManagerName(s.managerName);
    setManagerPhone(s.managerPhone);
    setIsModalOpen(true);
  };

  const handleSetPrimaryHub = async (id: string, nameStr: string) => {
    try {
      await fetch("/api/dark-stores", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, setPrimary: true }),
      });
      setStores((prev) =>
        prev.map((s) => ({
          ...s,
          isPrimary: s.id === id,
        }))
      );
      setToastMsg(`Active Primary Dark Store set to: ${nameStr}`);
      setTimeout(() => setToastMsg(null), 3000);
    } catch (e) {
      setStores((prev) =>
        prev.map((s) => ({ ...s, isPrimary: s.id === id }))
      );
    }
  };

  const handleSaveStore = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      code,
      name,
      address,
      city,
      pincode,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      coverageRadiusKm: parseFloat(coverageRadiusKm),
      status,
      managerName,
      managerPhone,
    };

    try {
      if (editingStore) {
        await fetch("/api/dark-stores", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingStore.id, updates: payload }),
        });
        setStores((prev) =>
          prev.map((s) => (s.id === editingStore.id ? { ...s, ...payload } : s))
        );
        setToastMsg(`Updated Dark Store Hub: ${name}`);
      } else {
        const res = await fetch("/api/dark-stores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.success && data.darkStore) {
          setStores([data.darkStore, ...stores]);
        } else {
          const fallback: DarkStore = {
            id: "ds_" + Date.now(),
            ...payload,
            totalOrdersToday: 0,
            isPrimary: stores.length === 0,
          };
          setStores([fallback, ...stores]);
        }
        setToastMsg(`Created New Dark Store Hub: ${name}`);
      }
    } catch (e) {
      fetchStores();
    } finally {
      setIsModalOpen(false);
      setTimeout(() => setToastMsg(null), 3000);
    }
  };

  const handleDeleteStore = async (id: string, nameStr: string) => {
    if (!confirm(`Are you sure you want to delete Dark Store "${nameStr}"?`)) return;

    try {
      await fetch(`/api/dark-stores?id=${id}`, { method: "DELETE" });
      setStores((prev) => prev.filter((s) => s.id !== id));
      setToastMsg(`Deleted Dark Store: ${nameStr}`);
      setTimeout(() => setToastMsg(null), 3000);
    } catch (e) {
      setStores((prev) => prev.filter((s) => s.id !== id));
    }
  };

  const applyPreset = (preset: typeof PRESET_COORDINATES[0]) => {
    setAddress(preset.address);
    setPincode(preset.pincode);
    setLat(preset.lat.toString());
    setLng(preset.lng.toString());
    if (!name) setName(`${preset.name} Hub`);
  };

  const primaryStore = stores.find((s) => s.isPrimary) || stores[0];

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-100">
            Dark Store Hub Management & Location Controls
          </h2>
          <p className="text-xs text-slate-400">
            Configure dark store hub locations, coverage radius, active primary fulfillment hub, and full CRUD operations
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-black text-slate-950 hover:bg-emerald-400 active:scale-95 transition-all shadow-md cursor-pointer"
        >
          <Plus className="h-4 w-4" /> Add New Dark Store Hub
        </button>
      </div>

      {toastMsg && (
        <div className="flex items-center gap-2 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 p-4 text-xs font-bold text-emerald-400 animate-in fade-in">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Primary Hub Overview Card */}
      {primaryStore && (
        <div className="rounded-3xl border border-emerald-500/40 bg-gradient-to-r from-emerald-950/60 via-slate-900 to-slate-950 p-6 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-3 w-3 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                ACTIVE PRIMARY FULFILLMENT DARK STORE HUB
              </span>
            </div>
            <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-mono font-black text-emerald-300 border border-emerald-500/30">
              {primaryStore.code}
            </span>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
            <div>
              <h3 className="text-xl font-black text-white">{primaryStore.name}</h3>
              <p className="text-xs text-slate-300 font-medium mt-1 flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-emerald-400" />
                {primaryStore.address}, {primaryStore.city} - {primaryStore.pincode}
              </p>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                GPS Lat/Lng: <strong className="text-emerald-300">{primaryStore.lat}, {primaryStore.lng}</strong> • Coverage: <strong className="text-emerald-300">{primaryStore.coverageRadiusKm} km Radius</strong>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-3 text-center min-w-[110px]">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Today's Orders</p>
                <p className="text-lg font-black text-emerald-400">{primaryStore.totalOrdersToday}</p>
              </div>

              <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-3 text-center min-w-[130px]">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Manager</p>
                <p className="text-xs font-bold text-white truncate">{primaryStore.managerName}</p>
                <p className="text-[10px] text-slate-400 font-mono">{primaryStore.managerPhone}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dark Stores Master Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {stores.map((store) => (
          <div
            key={store.id}
            className={`flex flex-col justify-between rounded-3xl border p-5 shadow-xl transition-all duration-300 ${
              store.isPrimary
                ? "border-emerald-500/80 bg-slate-900/90 ring-2 ring-emerald-500/30"
                : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[10px] font-mono font-bold text-slate-300 border border-slate-700">
                  {store.code}
                </span>

                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                      store.status === "active"
                        ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                        : store.status === "maintenance"
                        ? "bg-amber-950 text-amber-400 border border-amber-800"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    ● {store.status}
                  </span>

                  {store.isPrimary && (
                    <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] font-black text-slate-950">
                      PRIMARY
                    </span>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-base font-extrabold text-white">{store.name}</h4>
                <p className="text-xs text-slate-400 mt-1 flex items-start gap-1">
                  <MapPin className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span>{store.address}, {store.pincode}</span>
                </p>
              </div>

              <div className="rounded-2xl bg-slate-950 p-3 border border-slate-800/80 text-xs space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-500">Coordinates:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {store.lat.toFixed(4)}, {store.lng.toFixed(4)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-500">Coverage Radius:</span>
                  <span className="font-bold text-white">{store.coverageRadiusKm} km</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-500">Manager:</span>
                  <span className="font-semibold text-slate-200">{store.managerName} ({store.managerPhone})</span>
                </div>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
              {!store.isPrimary ? (
                <button
                  onClick={() => handleSetPrimaryHub(store.id, store.name)}
                  className="flex-1 rounded-xl bg-slate-800 py-2 text-xs font-bold text-emerald-400 hover:bg-emerald-950 border border-slate-700 transition-all cursor-pointer"
                >
                  Set as Active Hub
                </button>
              ) : (
                <span className="flex-1 text-center py-2 text-xs font-black text-emerald-400">
                  ✓ Active Dispatch Hub
                </span>
              )}

              <div className="flex items-center gap-1">
                <button
                  onClick={() => openEditModal(store)}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
                  title="Edit Dark Store"
                >
                  <Edit2 className="h-4 w-4" />
                </button>

                {!store.isPrimary && (
                  <button
                    onClick={() => handleDeleteStore(store.id, store.name)}
                    className="rounded-xl p-2 text-slate-400 hover:bg-rose-950 hover:text-rose-400 transition-colors cursor-pointer"
                    title="Delete Dark Store"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Dark Store CRUD Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
            onClick={() => setIsModalOpen(false)}
          />

          <div className="relative z-10 w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-800 bg-slate-900 p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-emerald-400" />
                <h3 className="text-base font-black text-white">
                  {editingStore ? "Edit Dark Store Hub" : "Create New Dark Store Hub"}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Quick Location Preset Selector */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Quick Coordinate Presets (Bhubaneswar Hubs)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PRESET_COORDINATES.map((preset) => (
                  <button
                    type="button"
                    key={preset.name}
                    onClick={() => applyPreset(preset)}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950 p-2 text-left text-xs font-semibold text-slate-300 hover:border-emerald-500 hover:text-emerald-400 transition-all"
                  >
                    <Locate className="h-3 w-3 text-emerald-400 flex-shrink-0" />
                    <span className="truncate">{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSaveStore} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Store Code
                  </label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g. DS-PATIA-01"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Dark Store Hub Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Patia Central Dark Store"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Full Street Address
                </label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Plot number, Landmark, Area name"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Bhubaneswar"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Pincode
                  </label>
                  <input
                    type="text"
                    required
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    placeholder="751024"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Latitude (GPS)
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    placeholder="20.2961"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Longitude (GPS)
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                    placeholder="85.8245"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Coverage Radius (km)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={coverageRadiusKm}
                    onChange={(e) => setCoverageRadiusKm(e.target.value)}
                    placeholder="5"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Manager Name
                  </label>
                  <input
                    type="text"
                    required
                    value={managerName}
                    onChange={(e) => setManagerName(e.target.value)}
                    placeholder="Rajesh Kumar"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Manager Phone
                  </label>
                  <input
                    type="tel"
                    required
                    value={managerPhone}
                    onChange={(e) => setManagerPhone(e.target.value)}
                    placeholder="+91 91234 56789"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Hub Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="active">Active (Operational)</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-xs font-bold text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-black text-slate-950 hover:bg-emerald-400 shadow-md"
                >
                  {editingStore ? "Save Changes" : "Create Dark Store Hub"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
