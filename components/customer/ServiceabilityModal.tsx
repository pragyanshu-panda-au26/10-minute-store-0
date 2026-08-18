"use client";

import { useState } from "react";
import { useUserStore } from "@/store/useUserStore";
import {
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Locate,
  Loader2,
  X,
  Building,
} from "lucide-react";

interface ServiceabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAddressStr: string;
}

export default function ServiceabilityModal({
  isOpen,
  onClose,
  currentAddressStr,
}: ServiceabilityModalProps) {
  const [pincode, setPincode] = useState("751024");
  const [status, setStatus] = useState<"checked_success" | "checked_out" | "idle">("checked_success");
  const [isLocating, setIsLocating] = useState(false);
  const [gpsMessage, setGpsMessage] = useState<string | null>(null);

  const { setGpsLocation } = useUserStore();

  if (!isOpen) return null;

  const validPincodes = ["751024", "751007", "751013", "751019", "751010", "751001"];

  const handleCheckPincode = (e: React.FormEvent) => {
    e.preventDefault();
    if (validPincodes.includes(pincode.trim())) {
      setStatus("checked_success");
    } else {
      setStatus("checked_out");
    }
  };

  const handleDetectGps = () => {
    setIsLocating(true);
    setGpsMessage(null);

    const fallbackTimer = setTimeout(() => {
      setGpsLocation(20.2961, 85.8245, "Patia Dark Store Zone");
      setIsLocating(false);
      setStatus("checked_success");
      setGpsMessage("GPS Location Set (20.2961, 85.8245) - 10 Min Zone Active!");
    }, 3500);

    if (typeof window !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(fallbackTimer);
          const { latitude, longitude } = pos.coords;
          setGpsLocation(latitude, longitude, "Patia Dark Store Zone");
          setIsLocating(false);
          setStatus("checked_success");
          setGpsMessage(`GPS Pin Detected (${latitude.toFixed(4)}, ${longitude.toFixed(4)}) - Express Zone Active!`);
        },
        (err) => {
          clearTimeout(fallbackTimer);
          setGpsLocation(20.2961, 85.8245, "Patia Dark Store Zone");
          setIsLocating(false);
          setStatus("checked_success");
          setGpsMessage("GPS Pin Set (20.2961, 85.8245) - Express Zone Active!");
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      clearTimeout(fallbackTimer);
      setGpsLocation(20.2961, 85.8245, "Patia Dark Store Zone");
      setIsLocating(false);
      setStatus("checked_success");
      setGpsMessage("GPS Pin Set (20.2961, 85.8245) - Express Zone Active!");
    }
  };

  const handleSelectQuickZone = (zoneName: string, pin: string, lat: number, lng: number) => {
    setPincode(pin);
    setGpsLocation(lat, lng, zoneName);
    setStatus("checked_success");
    setGpsMessage(`${zoneName} Dark Store Selected (10-Min Zone Active)`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/75 backdrop-blur-md animate-in fade-in"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl bg-white p-6 text-slate-900 shadow-2xl animate-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <Zap className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-extrabold text-slate-900">
              Check 10-Min Delivery Serviceability
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-50 p-3.5 border border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <MapPin className="h-4 w-4 text-emerald-600" />
                Active Selected Address
              </div>

              {/* Web Geolocation GPS Button */}
              <button
                onClick={handleDetectGps}
                disabled={isLocating}
                className="flex items-center gap-1 rounded-xl bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-xs hover:bg-emerald-500 active:scale-95"
              >
                {isLocating ? (
                  <Loader2 className="h-3 w-3 animate-spin text-white" />
                ) : (
                  <Locate className="h-3 w-3 text-white" />
                )}
                <span>{isLocating ? "Locating..." : "Use Live GPS"}</span>
              </button>
            </div>

            <p className="text-xs text-slate-600 mt-1 font-medium">
              {currentAddressStr}
            </p>

            {gpsMessage && (
              <p className="text-[11px] font-bold text-emerald-700 mt-2 bg-emerald-100/60 p-2 rounded-xl border border-emerald-200">
                {gpsMessage}
              </p>
            )}
          </div>

          {/* Quick Select Dark Store Zones */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Select Nearby Bhubaneswar Service Hub
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { name: "Patia Dark Store", pin: "751024", lat: 20.2961, lng: 85.8245 },
                { name: "Infocity Hub", pin: "751024", lat: 20.3587, lng: 85.8142 },
                { name: "Saheed Nagar", pin: "751007", lat: 20.2882, lng: 85.8421 },
                { name: "Jaydev Vihar", pin: "751013", lat: 20.3012, lng: 85.8285 },
              ].map((zone) => (
                <button
                  key={zone.name}
                  type="button"
                  onClick={() => handleSelectQuickZone(zone.name, zone.pin, zone.lat, zone.lng)}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 text-left hover:border-emerald-500 hover:bg-emerald-50/50 transition-all"
                >
                  <Building className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-slate-900">{zone.name}</p>
                    <p className="text-[10px] text-slate-500">Pincode {zone.pin}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Manual Pincode Search */}
          <form onSubmit={handleCheckPincode} className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              Or Test Custom 6-Digit Pincode
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                placeholder="Enter 6-digit Pincode"
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-500"
              >
                Verify Zone
              </button>
            </div>
          </form>

          {/* Status Feedback */}
          {status === "checked_success" && (
            <div className="rounded-2xl bg-emerald-50 p-4 border border-emerald-200 animate-in fade-in">
              <div className="flex items-center gap-2 text-emerald-800 font-extrabold text-xs">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                10-Minute Express Zone Active!
              </div>
              <p className="text-[11px] text-emerald-700 mt-1">
                Bhubaneswar Dark Store #01 is within 2.4 km. Full catalog available for immediate dispatch.
              </p>
            </div>
          )}

          {status === "checked_out" && (
            <div className="rounded-2xl bg-rose-50 p-4 border border-rose-200 animate-in fade-in">
              <div className="flex items-center gap-2 text-rose-800 font-extrabold text-xs">
                <AlertTriangle className="h-4 w-4 text-rose-600" />
                Outside 10-Minute Service Zone
              </div>
              <p className="text-[11px] text-rose-700 mt-1">
                We currently deliver within select Bhubaneswar pincodes (751024, 751007, 751013). New dark store launching soon!
              </p>
            </div>
          )}

          <button
            onClick={onClose}
            className="w-full rounded-xl bg-slate-900 py-3 text-xs font-bold text-white hover:bg-slate-800"
          >
            Start Shopping
          </button>
        </div>
      </div>
    </div>
  );
}
