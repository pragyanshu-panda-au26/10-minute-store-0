"use client";

import { useState } from "react";
import { useUserStore } from "@/store/useUserStore";
import {
  MapPin,
  Locate,
  Check,
  Plus,
  Home,
  Briefcase,
  Building,
  X,
  Loader2,
  Navigation,
  CheckCircle2,
} from "lucide-react";

interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LocationPickerModal({
  isOpen,
  onClose,
}: LocationPickerModalProps) {
  const { profile, setActiveAddress, setGpsLocation, addAddress } = useUserStore();

  const [isLocating, setIsLocating] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Quick New Address Form inside modal
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newLabel, setNewLabel] = useState("Home");
  const [newHouseNo, setNewHouseNo] = useState("");
  const [newArea, setNewArea] = useState("");
  const [newCity, setNewCity] = useState("Paradip, Odisha");
  const [newPincode, setNewPincode] = useState("754142");

  if (!isOpen) return null;

  // Use HTML5 Geolocation API ONLY (No IP Detection)
  const handleDetectGps = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsLocating(true);
    setToastMsg(null);

    if (typeof window !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setGpsLocation(latitude, longitude, "Live GPS Pin");
          setIsLocating(false);
          setToastMsg(`GPS Pin Set (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
          setTimeout(() => {
            setToastMsg(null);
            onClose();
          }, 1200);
        },
        (err) => {
          console.warn("Native GPS prompt denied/blocked:", err.message);
          setIsLocating(false);
          alert("Location access denied or unavailable. Please enable GPS location permissions in your browser.");
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setIsLocating(false);
      alert("HTML5 Geolocation API is not supported by your browser.");
    }
  };

  const handleSelectAddress = (id: string) => {
    setActiveAddress(id);
    onClose();
  };

  const handleSaveNewAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHouseNo.trim() || !newArea.trim()) return;

    addAddress({
      label: newLabel,
      houseNo: newHouseNo.trim(),
      area: newArea.trim(),
      city: newCity.trim(),
      pincode: newPincode.trim(),
    });

    setIsAddingNew(false);
    setNewHouseNo("");
    setNewArea("");
    onClose();
  };

  const getIcon = (label: string) => {
    switch (label.toLowerCase()) {
      case "home":
        return <Home className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
      case "work":
        return <Briefcase className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
      default:
        return <Building className="h-4 w-4 text-purple-600 dark:text-purple-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Background Overlay */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl bg-white dark:bg-slate-900 p-6 text-slate-900 dark:text-white shadow-2xl animate-in zoom-in-95 border border-slate-200 dark:border-slate-800 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              Choose Delivery Location
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {toastMsg && (
          // role=status + aria-live=polite so the message is announced to
          // screen readers without stealing focus (audit §8, toast-a11y).
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 p-3 text-xs font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* 1-Tap Detect Current GPS Location Button */}
        <button
          onClick={handleDetectGps}
          disabled={isLocating}
          className="w-full flex items-center justify-between rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 p-4 text-left hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold shadow-xs">
              {isLocating ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Locate className="h-5 w-5" />
              )}
            </div>
            <div>
              <p className="text-xs font-extrabold text-emerald-900 dark:text-emerald-300">
                {isLocating ? "Detecting GPS Position..." : "Use Current GPS Location"}
              </p>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                HTML5 Geolocation API (High Accuracy GPS)
              </p>
            </div>
          </div>
          <Navigation className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        </button>

        {/* Saved Address List */}
        {!isAddingNew ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                Saved Addresses
              </span>
              <button
                onClick={() => setIsAddingNew(true)}
                className="flex items-center gap-1 text-xs font-extrabold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" /> Add New
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto no-scrollbar">
              {profile.addresses.map((addr) => {
                const isActive = profile.activeAddressId === addr.id;
                return (
                  <div
                    key={addr.id}
                    onClick={() => handleSelectAddress(addr.id)}
                    className={`flex items-start justify-between rounded-2xl border p-3.5 cursor-pointer transition-all ${
                      isActive
                        ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 shadow-xs"
                        : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        {getIcon(addr.label)}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {addr.label}
                        </span>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium line-clamp-1">
                          {addr.houseNo}, {addr.area}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {addr.city} - {addr.pincode}
                        </p>
                      </div>
                    </div>

                    {isActive && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white text-[10px]">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Add New Address Form */
          <form onSubmit={handleSaveNewAddress} className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-white">Add Delivery Address</span>
              <button
                type="button"
                onClick={() => setIsAddingNew(false)}
                className="text-xs font-bold text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                Back to list
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                Tag Label
              </label>
              <div className="flex gap-2">
                {["Home", "Work", "Other"].map((lbl) => (
                  <button
                    key={lbl}
                    type="button"
                    onClick={() => setNewLabel(lbl)}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      newLabel === lbl
                        ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border-emerald-500"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                House / Flat No *
              </label>
              <input
                type="text"
                required
                value={newHouseNo}
                onChange={(e) => setNewHouseNo(e.target.value)}
                placeholder="e.g. Flat 402, Royal Palms"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 text-xs text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                Area / Street *
              </label>
              <input
                type="text"
                required
                value={newArea}
                onChange={(e) => setNewArea(e.target.value)}
                placeholder="e.g. Paradip Port Area"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 text-xs text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddingNew(false)}
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 rounded-xl bg-emerald-600 text-white py-2.5 text-xs font-extrabold shadow-md hover:bg-emerald-500 cursor-pointer"
              >
                Save & Use Location
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
