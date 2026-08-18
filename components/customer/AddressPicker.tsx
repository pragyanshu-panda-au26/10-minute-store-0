"use client";

import { useEffect, useState } from "react";
import {
  X,
  MapPin,
  Home,
  Briefcase,
  Bookmark,
  Plus,
  Check,
  Trash2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Address, useUserStore } from "@/store/useUserStore";

/**
 * Blinkit-style "Choose delivery address" bottom-sheet.
 *
 * Lists all of the signed-in customer's saved addresses. Tap one to make it
 * the active delivery address, or tap "Add new address" to open the form.
 *
 * Guests (no server session) see only whatever addresses live in localStorage
 * via `useUserStore` — still functional, just not shared across devices.
 */

interface AddressPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onAddNew: () => void;
  /** Optional callback fired after the user selects an address. */
  onPicked?: (address: Address) => void;
}

const LABEL_ICON: Record<string, any> = {
  Home,
  Work: Briefcase,
  Other: Bookmark,
};

export default function AddressPicker({
  isOpen,
  onClose,
  onAddNew,
  onPicked,
}: AddressPickerProps) {
  const {
    isLoggedIn,
    profile,
    setActiveAddress,
    deleteAddress,
  } = useUserStore();

  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // For signed-in users: fetch fresh from server so the list reflects
  // whatever the customer added on another device. Merges into zustand.
  useEffect(() => {
    if (!isOpen || !isLoggedIn) return;
    let cancelled = false;
    (async () => {
      setRemoteLoading(true);
      setRemoteError(null);
      try {
        const res = await fetch("/api/customers/me/addresses", {
          credentials: "include",
        });
        const data = await res.json();
        if (cancelled) return;
        if (!data.success) throw new Error(data.message ?? "Failed to load");

        // Merge server addresses into the local store without touching
        // guest-only entries. Server list wins for anything with a matching id.
        const serverAddrs: Address[] = data.addresses;
        const store = useUserStore.getState();
        const localOnly = store.profile.addresses.filter(
          (a) => !serverAddrs.find((s) => s.id === a.id) && a.id.startsWith("addr_")
        );
        useUserStore.setState({
          profile: {
            ...store.profile,
            addresses: [...serverAddrs, ...localOnly],
            activeAddressId:
              serverAddrs.find((a) => a.id === store.profile.activeAddressId)?.id ??
              serverAddrs.find((a) => a.isDefault)?.id ??
              serverAddrs[0]?.id ??
              store.profile.activeAddressId,
          },
        });
      } catch (err: any) {
        if (!cancelled) setRemoteError(err.message ?? "Failed to load addresses");
      } finally {
        if (!cancelled) setRemoteLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, isLoggedIn]);

  const handlePick = (addr: Address) => {
    setActiveAddress(addr.id);
    onPicked?.(addr);
    onClose();
  };

  const handleDelete = async (addr: Address, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete "${addr.label}" — ${addr.houseNo}?`)) return;
    setPendingDeleteId(addr.id);
    try {
      await deleteAddress(addr.id);
    } finally {
      setPendingDeleteId(null);
    }
  };

  if (!isOpen) return null;

  const addresses = profile.addresses;
  const activeId = profile.activeAddressId;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative z-10 w-full sm:max-w-md sm:mx-4 bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">
                Choose delivery address
              </h2>
              <p className="text-[11px] text-slate-500">
                {addresses.length} saved {addresses.length === 1 ? "address" : "addresses"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Add new address CTA — sticky at top so it's always reachable */}
        <button
          onClick={onAddNew}
          className="mx-5 mt-4 flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 py-3 text-sm font-black text-emerald-700 hover:bg-emerald-50"
        >
          <Plus className="h-4 w-4" />
          Add a new address
        </button>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2.5">
          {remoteLoading && (
            <div className="flex items-center justify-center py-3 text-xs text-slate-400 gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Syncing…
            </div>
          )}

          {remoteError && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{remoteError}</span>
            </div>
          )}

          {addresses.length === 0 && !remoteLoading && (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <MapPin className="h-8 w-8 text-slate-300" />
              <p className="text-xs font-semibold text-slate-500">
                No saved addresses yet.
              </p>
              <p className="text-[11px] text-slate-400">
                Tap &ldquo;Add a new address&rdquo; above to get started.
              </p>
            </div>
          )}

          {addresses.map((addr) => {
            const isActive = addr.id === activeId;
            const Icon = LABEL_ICON[addr.label] ?? MapPin;
            const isDeleting = pendingDeleteId === addr.id;
            return (
              <button
                key={addr.id}
                onClick={() => handlePick(addr)}
                className={`w-full flex items-start gap-3 rounded-2xl border p-3.5 text-left transition-all ${
                  isActive
                    ? "border-emerald-500 bg-emerald-50/60 shadow-xs"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div
                  className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${
                    isActive
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-900">
                      {addr.label}
                    </span>
                    {addr.isDefault && (
                      <span className="rounded-full bg-slate-900 px-1.5 py-0.5 text-[9px] font-black text-white uppercase tracking-wider">
                        Default
                      </span>
                    )}
                    {isActive && (
                      <span className="flex items-center gap-0.5 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-black text-white uppercase tracking-wider">
                        <Check className="h-2.5 w-2.5" /> Selected
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-800 font-semibold line-clamp-2">
                    {addr.houseNo}, {addr.area}
                  </p>
                  <p className="text-[11px] text-slate-500 line-clamp-1">
                    {addr.city} — {addr.pincode}
                  </p>
                  {addr.landmark && (
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      <span className="font-semibold">Landmark:</span> {addr.landmark}
                    </p>
                  )}
                  {addr.contactPhone && (
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Call: {addr.contactPhone}
                    </p>
                  )}
                </div>

                {/* Only show delete for server-backed addresses (signed-in users)
                    AND when there's more than one, so users can't strand themselves. */}
                {isLoggedIn && addresses.length > 1 && (
                  <button
                    onClick={(e) => handleDelete(addr, e)}
                    disabled={isDeleting}
                    className="flex-shrink-0 rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                    aria-label={`Delete ${addr.label}`}
                  >
                    {isDeleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
