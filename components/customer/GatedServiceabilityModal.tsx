"use client";

import { useEffect, useState } from "react";
import {
  ShieldAlert,
  Loader2,
  Navigation,
  Compass,
  AlertTriangle,
  Search,
  X,
} from "lucide-react";
import { useUserStore } from "@/store/useUserStore";

interface GatedServiceabilityModalProps {
  onServiceableConfirmed: (storeId: string) => void;
}

// ─── Serviceability cache ──────────────────────────────────────
// Persist a successful check so users don't get prompted on every
// reload / route change. TTL is short (1 h): the owner can change
// the radius at any moment, and a stale cached "yes" would keep a
// now-out-of-zone customer clicking Buy on orders the server will
// refuse. On a fresh page load we ALSO revalidate in the background
// (see below) so a shrinking radius is picked up within one refresh
// instead of waiting for the whole hour to elapse.
const CACHE_KEY = "satyug_serviceability_v2";
const CACHE_TTL_MS = 60 * 60 * 1000;

// Session-only flag: user tapped "Just browsing" — don't re-prompt until
// they either navigate away or hit an action that needs an address (add
// to cart, checkout). Session-scoped is deliberate: it should NOT persist
// across browser sessions the way the serviceability cache does, because
// then a returning customer never gets the location ask.
const BROWSE_ONLY_FLAG = "satyug_browse_only_v1";

// Sentinel store id emitted when the user is browsing without a delivery
// address yet. The products API ignores an unknown `store_id` and returns the
// same catalog, so this is enough to unblock `fetchProducts()` in the parent
// while we still know at the caller side that no real store is bound.
const STORE_BROWSE_ONLY = "STORE_BROWSE_ONLY";

interface CachedServiceability {
  storeId: string;
  storeName?: string;
  lat: number;
  lng: number;
  distanceKm?: number;
  etaMinutes?: number | null;
  label?: string;
  checkedAt: number;
}

export default function GatedServiceabilityModal({
  onServiceableConfirmed,
}: GatedServiceabilityModalProps) {
  // Modal states: 'prompt' -> 'loading' -> 'serviceable' | 'out_of_zone'
  const [phase, setPhase] = useState<
    "prompt" | "loading" | "serviceable" | "out_of_zone"
  >("prompt");

  const [serviceableInfo, setServiceableInfo] = useState<{
    store_id: string;
    store_name: string;
    distance_km: number;
    eta_minutes: number | null;
  } | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [manualAddressInput, setManualAddressInput] = useState("");
  const [isGeocoding, setIsGeocoding] = useState(false);
  // (Removed unused `isHttpOrigin` state — the value it tracked was never
  // read; the http-vs-https hint already lives inline in errorMsg copy.)

  const { setGpsLocation } = useUserStore();

  /**
   * On mount: check localStorage for a fresh (< 24h) serviceable result and
   * skip the entire GPS + serviceability flow. This is what stops the modal
   * from re-prompting for location on every reload / route change.
   *
   * If the cache is stale or missing, fall through and let the user tap the
   * "Allow location" button.
   */
  useEffect(() => {
    // "Just browsing" — user opted to look at the catalog without setting
    // a delivery address yet. Skip the modal entirely for this session; the
    // add-to-cart / checkout paths will prompt again when it actually matters.
    try {
      if (sessionStorage.getItem(BROWSE_ONLY_FLAG) === "1") {
        // Fire the parent callback so `fetchProducts()` runs on this
        // session-continuation, otherwise the catalog stays empty on every
        // reload after the very first "Just browsing" tap.
        onServiceableConfirmed(STORE_BROWSE_ONLY);
        setPhase("serviceable");
        return;
      }
    } catch {}

    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return;
      const cached = JSON.parse(raw) as CachedServiceability;
      const age = Date.now() - cached.checkedAt;
      if (
        !cached.storeId ||
        !Number.isFinite(cached.lat) ||
        !Number.isFinite(cached.lng) ||
        age > CACHE_TTL_MS
      ) {
        localStorage.removeItem(CACHE_KEY);
        return;
      }
      // Restore the last-known location into the user store & unlock the app
      setGpsLocation(cached.lat, cached.lng, cached.label || "Saved Location");
      setServiceableInfo({
        store_id: cached.storeId,
        store_name: cached.storeName || "",
        distance_km: cached.distanceKm ?? 0,
        eta_minutes: cached.etaMinutes ?? null,
      });
      onServiceableConfirmed(cached.storeId);
      setPhase("serviceable");

      // Background revalidate — the customer's coordinates haven't moved, but
      // the delivery radius could have changed since we cached this result.
      // Non-blocking: the UI stays unlocked while the check runs. Only if the
      // server now says out-of-zone do we drop the cache and re-prompt.
      void (async () => {
        try {
          const res = await fetch(
            `/api/check-serviceability?lat=${cached.lat}&lng=${cached.lng}`,
            { cache: "no-store" }
          );
          const data = await res.json();
          const stillServiceable =
            res.ok && data && (data.serviceable === true || data.serviceable === "true");
          if (!stillServiceable) {
            localStorage.removeItem(CACHE_KEY);
            setPhase("out_of_zone");
            setErrorMsg(
              data?.message ||
                "Delivery zone changed and your saved address is no longer covered."
            );
          }
        } catch {
          // Network error — keep the cached decision, we'll try again on next mount.
        }
      })();
    } catch (err) {
      console.warn("[serviceability] cache read failed:", err);
      localStorage.removeItem(CACHE_KEY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pass (latitude, longitude) to backend /api/check-serviceability API call
  const handleVerifyCoordinates = async (
    lat: number,
    lng: number,
    addressLabel?: string
  ) => {
    setPhase("loading");
    setErrorMsg(null);

    try {
      const res = await fetch(
        `/api/check-serviceability?lat=${lat}&lng=${lng}`
      );
      const data = await res.json();

      if (res.ok && data.serviceable) {
        setServiceableInfo({
          store_id: data.store_id,
          store_name: data.store_name,
          distance_km: data.distance_km,
          eta_minutes: data.eta_minutes,
        });

        // Save active store and location in global state
        setGpsLocation(lat, lng, addressLabel || "Current Location");
        onServiceableConfirmed(data.store_id);

        // Persist to localStorage so the next page load doesn't re-prompt
        try {
          const payload: CachedServiceability = {
            storeId: data.store_id,
            storeName: data.store_name,
            lat,
            lng,
            distanceKm: data.distance_km,
            etaMinutes: data.eta_minutes,
            label: addressLabel,
            checkedAt: Date.now(),
          };
          localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
        } catch {
          // Storage full / disabled — non-fatal
        }

        setPhase("serviceable");
      } else {
        setPhase("out_of_zone");
        // Clear any stale cache so future loads re-check
        try { localStorage.removeItem(CACHE_KEY); } catch {}
        if (data.reason === "out_of_zone") {
          setErrorMsg(
            `You're about ${data.distance_km || "a few"} km outside our current delivery area. We're expanding — try again in a few weeks.`
          );
        } else {
          setErrorMsg(data.message || "Coordinates are outside delivery zone.");
        }
      }
    } catch (err) {
      console.error("Serviceability verification API error:", err);
      setErrorMsg("Network error checking serviceability. Please retry.");
      setPhase("out_of_zone");
    }
  };

  // Triggered directly by user TAP / CLICK event
  const handleRequestBrowserLocation = async () => {
    setErrorMsg(null);

    if (typeof window === "undefined" || !navigator.geolocation) {
      setPhase("out_of_zone");
      setErrorMsg("HTML5 Geolocation API is not supported by your mobile browser.");
      return;
    }

    setPhase("loading");

    const isHttpNonLocalhost =
      window.location.protocol === "http:" &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1";

    // Small helper: promisified getCurrentPosition with configurable options.
    const getPosition = (opts: PositionOptions) =>
      new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, opts)
      );

    /**
     * Two-stage strategy — high-accuracy GPS on phones can take 15–30 s to
     * acquire a fresh fix indoors, so we:
     *   1) Try FAST low-accuracy Wi-Fi/cell fix (≤6 s). Good to ~500 m,
     *      plenty for a 3 km delivery zone check.
     *   2) If that fails, try HIGH-accuracy GPS with a generous timeout
     *      (25 s) and accept a fix cached up to 5 minutes old.
     *
     * The previous config (`enableHighAccuracy: true`, `timeout: 10000`,
     * `maximumAge: 0`) was too strict and timed out even after the user
     * had granted permission.
     */
    let pos: GeolocationPosition | null = null;
    let lastErr: GeolocationPositionError | null = null;

    try {
      pos = await getPosition({
        enableHighAccuracy: false,
        timeout: 6000,
        maximumAge: 5 * 60 * 1000,
      });
    } catch (err) {
      lastErr = err as GeolocationPositionError;
      // Only retry with high-accuracy if this wasn't a permission denial
      if (lastErr.code !== 1) {
        try {
          pos = await getPosition({
            enableHighAccuracy: true,
            timeout: 25000,
            maximumAge: 5 * 60 * 1000,
          });
          lastErr = null;
        } catch (err2) {
          lastErr = err2 as GeolocationPositionError;
        }
      }
    }

    if (pos) {
      handleVerifyCoordinates(
        pos.coords.latitude,
        pos.coords.longitude,
        "Live GPS Location"
      );
      return;
    }

    // We failed — show a message that matches the real error code.
    console.warn(
      "[geolocation] failed:",
      lastErr?.code,
      lastErr?.message
    );
    setPhase("out_of_zone");

    if (lastErr?.code === 1) {
      // PERMISSION_DENIED
      setErrorMsg(
        isHttpNonLocalhost
          ? "Mobile browsers block GPS on http:// LAN URLs. Use https:// (npm run dev:https), a tunnel (cloudflared), or enter your address below."
          : "You blocked location permission. Reset it: browser settings → Site settings → Location → Allow — then retry."
      );
    } else if (lastErr?.code === 2) {
      // POSITION_UNAVAILABLE — no GPS lock (indoors, airplane mode, no signal)
      setErrorMsg(
        "Your device couldn't get a GPS fix — try moving near a window, enabling Wi-Fi (it helps positioning), or enter your address below."
      );
    } else if (lastErr?.code === 3) {
      // TIMEOUT
      setErrorMsg(
        "GPS lookup timed out. This usually means poor GPS signal indoors. Tap retry, or enter your address below."
      );
    } else {
      setErrorMsg(
        `Location error${lastErr ? ` (code ${lastErr.code})` : ""}: ${
          lastErr?.message ?? "unknown"
        }. Try again or enter your address below.`
      );
    }
  };

  // Geocode manual address entry via our server route (Google → Nominatim
  // fallback). Calling Nominatim from the browser was rejected in review:
  // Nominatim requires a User-Agent header, which the browser fetch spec
  // forbids setting — anonymous requests get rate-limited / blocked.
  const handleGeocodeManualAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = manualAddressInput.trim();
    if (!q) return;

    setIsGeocoding(true);
    setErrorMsg(null);
    try {
      const res = await fetch(
        `/api/geocode/forward?q=${encodeURIComponent(q)}&countryCode=in`
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(
          data?.message ||
            "Could not geocode that address. Try a more specific one, or tap the Paradip Store button below."
        );
        return;
      }
      await handleVerifyCoordinates(data.lat, data.lng, data.display_name || q);
    } catch (err) {
      console.error("Geocoding failed:", err);
      setErrorMsg(
        "Geocoding failed — check your connection, or tap the Paradip Store button below."
      );
    } finally {
      setIsGeocoding(false);
    }
  };

  if (phase === "serviceable") {
    return null;
  }

  // ─── PROMPT PHASE — NON-BLOCKING TOP STRIP ─────────────────────
  // Blinkit-parity: the shopper should see the catalog immediately and
  // decide about location on their own time. A blocking full-screen overlay
  // here was the biggest bounce cause — every hesitant first-time visitor
  // was staring at a modal instead of merchandise.
  //
  // The strip sits under the header (top-14 clears CustomerHeader's height on
  // mobile), stays visible while the shopper scrolls, and offers three paths:
  // GPS, manual address (via a "Set location" tap that promotes to the modal
  // via the loading path), or dismiss. Loading + out-of-zone remain modal
  // because they're transient / require attention.
  if (phase === "prompt") {
    const dismissBrowseOnly = () => {
      try { sessionStorage.setItem(BROWSE_ONLY_FLAG, "1"); } catch {}
      onServiceableConfirmed(STORE_BROWSE_ONLY);
      setPhase("serviceable");
    };

    return (
      <div className="sticky top-14 z-40 mx-3 mt-2 rounded-2xl border border-amber-300/80 bg-amber-50 shadow-md animate-in slide-in-from-top-2">
        <div className="flex items-center gap-3 px-3 py-2.5">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-amber-400 text-slate-950">
            <Navigation className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black text-slate-900 leading-tight">
              Set your delivery location
            </p>
            <p className="text-[10px] text-slate-700 leading-tight mt-0.5">
              We&rsquo;ll show what&rsquo;s in stock and how fast we can deliver.
            </p>
          </div>
          <button
            onClick={handleRequestBrowserLocation}
            className="flex-shrink-0 rounded-xl bg-slate-950 px-2.5 py-1.5 text-[10px] font-black text-white hover:bg-slate-800 active:scale-95 transition-all cursor-pointer"
          >
            Use GPS
          </button>
          <button
            onClick={dismissBrowseOnly}
            aria-label="Dismiss location prompt"
            className="flex-shrink-0 rounded-full p-1 text-slate-500 hover:bg-amber-100 hover:text-slate-900 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // ─── LOADING + OUT-OF-ZONE PHASES — BLOCKING MODAL ────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Dark Blur Overlay */}
      <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md" />

      {/* Modal Container */}
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 text-white shadow-2xl animate-in zoom-in-95 p-6 space-y-5">
        {/* PHASE 1: LOADING STATE */}
        {phase === "loading" && (
          <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center">
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-white">
                Checking if we deliver to you…
              </h3>
              <p className="text-xs text-slate-400 max-w-xs">
                Should only take a couple of seconds.
              </p>
            </div>
          </div>
        )}

        {/* NOTE: the `prompt` phase is now rendered as a non-blocking top
            strip above this modal branch (Blinkit-parity — catalog visible
            immediately, decide about location on your own time). Only the
            transient `loading` and error `out_of_zone` phases still block. */}

        {/* PHASE 3: 403 FORBIDDEN / OUT OF ZONE SCREEN */}
        {phase === "out_of_zone" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-white">
                  We don&rsquo;t deliver here yet
                </h3>
                <p className="text-[11px] text-rose-400 font-semibold">
                  You&rsquo;re just outside our delivery area.
                </p>
              </div>
            </div>

            {errorMsg && (
              <div className="rounded-2xl border border-rose-800/80 bg-rose-950/60 p-3 text-xs text-rose-300 leading-relaxed flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Manual Address Input Box */}
            <form onSubmit={handleGeocodeManualAddress} className="space-y-2 pt-1">
              <label className="block text-xs font-bold text-slate-300">
                Enter Delivery Address Manually
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={manualAddressInput}
                    onChange={(e) => setManualAddressInput(e.target.value)}
                    placeholder="e.g. Paradip Port, Odisha"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isGeocoding}
                  className="rounded-xl bg-slate-800 border border-slate-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-700 disabled:opacity-50 cursor-pointer"
                >
                  {isGeocoding ? "Checking..." : "Verify"}
                </button>
              </div>
            </form>

            {/* Try Again with HTML5 Geolocation API */}
            <div className="pt-1 space-y-2">
              <button
                onClick={handleRequestBrowserLocation}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-400 py-2.5 text-xs font-black text-slate-950 hover:bg-amber-300 shadow-md cursor-pointer"
              >
                <Compass className="h-4 w-4" /> Retry HTML5 Geolocation API
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
