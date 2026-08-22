"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  X,
  MapPin,
  LocateFixed,
  Home,
  Briefcase,
  Bookmark,
  User,
  Phone,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Building2,
  MoveDiagonal,
} from "lucide-react";
import { Address, useUserStore } from "@/store/useUserStore";
import { Skeleton } from "@/components/customer/Skeleton";

// Leaflet accesses `window` at import time — must not run during SSR.
const AddressPinMap = dynamic(() => import("./AddressPinMap"), {
  ssr: false,
  loading: () => <Skeleton className="h-48 w-full rounded-2xl" />,
});

/**
 * Blinkit-style "Add / Edit Address" bottom-sheet.
 *
 * Flow:
 *   1. Auto-fetches GPS on open (unless we already have coords).
 *   2. Reverse-geocodes via /api/geocode/reverse (free Nominatim) to
 *      auto-fill house/area/city/pincode — every field stays editable.
 *   3. User adds landmark + contact name/phone + picks label (Home / Work / Other).
 *   4. Save posts to /api/customers/me/addresses (POST or PATCH) and calls
 *      `onSaved(address)` so the parent can set it active.
 *
 * Reusable from checkout, profile, or the "Add another address" button
 * anywhere in the app.
 */

interface AddressFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (address: Address) => void;
  /** Pass an existing address to edit in-place. Omit for a new address. */
  initial?: Address;
  /** Called with any error the parent might want to display outside the modal. */
  onError?: (msg: string) => void;
}

const LABEL_OPTIONS: { value: string; icon: any; hint: string }[] = [
  { value: "Home", icon: Home, hint: "Home" },
  { value: "Work", icon: Briefcase, hint: "Work" },
  { value: "Other", icon: Bookmark, hint: "Other" },
];

export default function AddressFormModal({
  isOpen,
  onClose,
  onSaved,
  initial,
  onError,
}: AddressFormModalProps) {
  const isEdit = Boolean(initial?.id);
  const { addAddress, updateAddress, profile } = useUserStore();

  // Form state — pre-filled from `initial` when editing, blank otherwise
  const [label, setLabel] = useState(initial?.label || "Home");
  const [houseNo, setHouseNo] = useState(initial?.houseNo || "");
  const [area, setArea] = useState(initial?.area || "");
  const [city, setCity] = useState(initial?.city || "");
  const [pincode, setPincode] = useState(initial?.pincode || "");
  const [landmark, setLandmark] = useState(initial?.landmark || "");
  const [contactName, setContactName] = useState(
    initial?.contactName || profile.name || ""
  );
  const [contactPhone, setContactPhone] = useState(
    initial?.contactPhone || profile.phone || ""
  );
  const [lat, setLat] = useState<number | undefined>(initial?.lat);
  const [lng, setLng] = useState<number | undefined>(initial?.lng);
  const [isDefault, setIsDefault] = useState(initial?.isDefault ?? false);

  const [gpsBusy, setGpsBusy] = useState(false);
  const [reverseBusy, setReverseBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [gpsLabel, setGpsLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const initialFetchedRef = useRef(false);

  // Auto-detect GPS every time the modal is opened for a NEW address (not an
  // edit). Previously the ref latched to `true` after the first successful
  // detect, so if the user closed the modal and reopened it during the same
  // session no location was ever fetched again — they'd stare at a blank
  // form with no map. Reset the guard when the modal closes so the next
  // open re-runs the detect flow, and only skip re-firing while the same
  // open is in-flight.
  useEffect(() => {
    if (!isOpen) {
      initialFetchedRef.current = false;
      return;
    }
    if (isEdit) return;
    if (initialFetchedRef.current) return;
    initialFetchedRef.current = true;
    void detectLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Sensible default coordinates for the pin so the map always renders and
  // is immediately draggable — even before GPS resolves (or if the user
  // denied permission). We pick the app's serviceable centre so a stray
  // pin is at worst inside the delivery zone.
  const DEFAULT_LAT = 20.2961; // Bhubaneswar / Odisha central area
  const DEFAULT_LNG = 85.8245;
  const mapLat = lat ?? DEFAULT_LAT;
  const mapLng = lng ?? DEFAULT_LNG;

  const detectLocation = async () => {
    setError(null);
    if (typeof window === "undefined" || !navigator.geolocation) {
      setError("Geolocation isn't available in this browser.");
      return;
    }

    setGpsBusy(true);
    const getPos = (opts: PositionOptions) =>
      new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, opts)
      );

    let pos: GeolocationPosition | null = null;
    try {
      // Fast low-accuracy fix (Wi-Fi/cell) — plenty for reverse geocoding.
      pos = await getPos({
        enableHighAccuracy: false,
        timeout: 6000,
        maximumAge: 5 * 60 * 1000,
      });
    } catch {
      // Fall back to high-accuracy GPS
      try {
        pos = await getPos({
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 5 * 60 * 1000,
        });
      } catch (err: any) {
        setGpsBusy(false);
        setError(
          err?.code === 1
            ? "Location permission blocked. Enter address manually."
            : "Couldn't get your location. Enter address manually."
        );
        return;
      }
    }

    setLat(pos.coords.latitude);
    setLng(pos.coords.longitude);
    setGpsBusy(false);
    await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
  };

  const reverseGeocode = async (latitude: number, longitude: number) => {
    setReverseBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/geocode/reverse?lat=${latitude}&lng=${longitude}`
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.message ?? "Reverse geocode failed");

      // Only overwrite fields the user hasn't already typed into
      if (!houseNo.trim() && data.houseNo) setHouseNo(data.houseNo);
      if (!area.trim() && data.area) setArea(data.area);
      if (!city.trim() && data.city) setCity(data.city);
      if (!pincode.trim() && data.pincode) setPincode(data.pincode);
      setGpsLabel(data.display_name || null);
    } catch (err: any) {
      // Non-fatal — user can still type manually
      console.warn("[address] reverse geocode failed:", err);
      setError(
        "Couldn't auto-detect your address. Fill in the fields below manually."
      );
    } finally {
      setReverseBusy(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Minimal client-side validation — matches server zod schema
    if (!houseNo.trim() || !area.trim() || !city.trim() || pincode.trim().length < 4) {
      setError("Fill in house/flat, area, city, and a valid pincode.");
      return;
    }

    setSaveBusy(true);
    const payload = {
      label: label.trim() || "Home",
      houseNo: houseNo.trim(),
      area: area.trim(),
      city: city.trim(),
      pincode: pincode.trim(),
      landmark: landmark.trim() || undefined,
      contactName: contactName.trim() || undefined,
      contactPhone: contactPhone.trim() || undefined,
      lat,
      lng,
      isDefault,
    };

    try {
      let saved: Address | null;
      if (isEdit && initial?.id) {
        await updateAddress(initial.id, payload);
        saved = { ...initial, ...payload } as Address;
      } else {
        saved = await addAddress(payload);
      }
      if (!saved) throw new Error("Save failed");
      onSaved?.(saved);
      onClose();
    } catch (err: any) {
      const msg = err?.message ?? "Failed to save address.";
      setError(msg);
      onError?.(msg);
    } finally {
      setSaveBusy(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm"
        onClick={() => !saveBusy && onClose()}
      />

      <form
        onSubmit={handleSave}
        className="relative z-10 w-full sm:max-w-md sm:mx-4 bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">
                {isEdit ? "Edit address" : "Add a new address"}
              </h2>
              <p className="text-[11px] text-slate-500">
                Auto-fills from your location — every field is editable.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saveBusy}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* "Use my current location" card */}
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
          <button
            type="button"
            onClick={detectLocation}
            disabled={gpsBusy || reverseBusy}
            className="w-full flex items-center justify-between rounded-xl bg-white border border-emerald-200 px-3 py-2.5 text-left disabled:opacity-60"
          >
            <div className="flex items-center gap-2.5">
              {gpsBusy || reverseBusy ? (
                <Loader2 className="h-5 w-5 text-emerald-600 animate-spin" />
              ) : (
                <LocateFixed className="h-5 w-5 text-emerald-600" />
              )}
              <div>
                <p className="text-xs font-black text-slate-900">
                  {gpsBusy
                    ? "Getting your location…"
                    : reverseBusy
                      ? "Detecting your address…"
                      : lat && lng
                        ? "Location detected"
                        : "Use my current location"}
                </p>
                {gpsLabel && !gpsBusy && !reverseBusy && (
                  <p className="text-[10px] text-slate-500 line-clamp-1">{gpsLabel}</p>
                )}
                {lat && lng && !gpsLabel && !reverseBusy && (
                  <p className="text-[10px] text-slate-500 font-mono">
                    {lat.toFixed(4)}, {lng.toFixed(4)}
                  </p>
                )}
              </div>
            </div>
            <span className="text-[11px] font-bold text-emerald-700">
              {lat && lng ? "Re-detect" : "Detect"}
            </span>
          </button>
        </div>

        {/* Scrollable form body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Draggable-pin map — ALWAYS rendered so the drag/tap interaction
              is available from the moment the modal opens, even before GPS
              has resolved. Before, we only mounted the map after coordinates
              arrived, so a denied/timed-out GPS meant the user never saw a
              map at all and "drag to adjust" wasn't offered. */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {lat != null && lng != null
                  ? "Confirm exact location"
                  : "Pick your delivery point"}
              </p>
              <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                <MoveDiagonal className="h-3 w-3" /> Drag pin or tap the map
              </span>
            </div>
            <AddressPinMap
              lat={mapLat}
              lng={mapLng}
              onMove={async (newLat, newLng) => {
                setLat(newLat);
                setLng(newLng);
                await reverseGeocode(newLat, newLng);
              }}
            />
            {lat == null && lng == null && (
              <p className="text-[10px] text-slate-500">
                Showing a default map. Tap “Detect” above to use your GPS, or
                drop the pin manually.
              </p>
            )}
          </div>

          {/* Label chips */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Save as
            </p>
            <div className="flex gap-2">
              {LABEL_OPTIONS.map(({ value, icon: Icon, hint }) => {
                const active = label === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setLabel(value)}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                      active
                        ? "bg-emerald-600 text-white shadow"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {hint}
                  </button>
                );
              })}
            </div>
          </div>

          <Field
            label="House / flat / floor no. *"
            icon={<Building2 className="h-4 w-4 text-slate-400" />}
            value={houseNo}
            onChange={setHouseNo}
            placeholder="Flat 402, Royal Palms"
            required
          />

          <Field
            label="Area, street, locality *"
            icon={<MapPin className="h-4 w-4 text-slate-400" />}
            value={area}
            onChange={setArea}
            placeholder="Patia, Bhubaneswar"
            required
          />

          <Field
            label="Landmark (optional)"
            icon={<MapPin className="h-4 w-4 text-slate-400" />}
            value={landmark}
            onChange={setLandmark}
            placeholder="e.g. Near KIIT Square"
          />

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="City *"
              value={city}
              onChange={setCity}
              placeholder="Bhubaneswar"
              required
            />
            <Field
              label="Pincode *"
              value={pincode}
              onChange={(v) => setPincode(v.replace(/\D/g, "").slice(0, 6))}
              placeholder="751024"
              inputMode="numeric"
              required
            />
          </div>

          {/* Divider */}
          <div className="pt-2 border-t border-slate-100" />

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Contact at delivery
            </p>
            <div className="space-y-3">
              <Field
                label="Receiver's name"
                icon={<User className="h-4 w-4 text-slate-400" />}
                value={contactName}
                onChange={setContactName}
                placeholder="Person receiving the order"
              />
              <Field
                label="Call at this number"
                icon={<Phone className="h-4 w-4 text-slate-400" />}
                value={contactPhone}
                onChange={setContactPhone}
                placeholder="+91 98765 43210"
                inputMode="tel"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 pt-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="h-4 w-4 accent-emerald-600"
            />
            <span className="text-xs font-semibold text-slate-700">
              Make this my default address
            </span>
          </label>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Sticky footer */}
        <div
          className="border-t border-slate-100 bg-white px-5 py-3"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
        >
          <button
            type="submit"
            disabled={saveBusy}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 active:scale-[0.99] disabled:opacity-60"
          >
            {saveBusy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                {isEdit ? "Save changes" : "Save address"}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ─── Small labelled-input primitive to keep the form JSX tight ─── */
function Field({
  label,
  value,
  onChange,
  placeholder,
  icon,
  required,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  required?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <div>
      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
        {label}
      </label>
      <div className="relative">
        {icon && <span className="absolute left-3 top-3">{icon}</span>}
        <input
          type="text"
          required={required}
          inputMode={inputMode}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-3 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none ${
            icon ? "pl-9" : "pl-3"
          }`}
        />
      </div>
    </div>
  );
}
