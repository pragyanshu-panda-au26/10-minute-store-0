"use client";

import { useEffect, useState } from "react";
import {
  X,
  Plus,
  Home,
  Briefcase,
  Bookmark,
  Pencil,
  Trash2,
  Check,
  Loader2,
  AlertCircle,
  MapPin,
} from "lucide-react";
import { Address, useUserStore } from "@/store/useUserStore";
import AddressFormModal from "@/components/customer/AddressFormModal";

/**
 * Address Book — full CRUD surface for saved addresses.
 *
 * The profile page's "Address book" row used to open LocationPickerModal,
 * a quick-picker with an in-place add form and no edit or delete. This is
 * the proper management screen: list every saved address, edit any of
 * them, delete any of them, set any of them as the active delivery
 * address. Add / Edit reuses the existing AddressFormModal, which already
 * knows how to do GPS + reverse-geocode + validation.
 *
 * Kept as a modal (not a route) so it composes with the profile page and
 * inherits its scroll position on close — matches how every other CRUD
 * surface in the app is presented.
 */

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

// One canonical mapping from label → icon, so a "Home" address renders
// with the same glyph everywhere in the app (audit finding: address list
// items looked identical because labels weren't visually differentiated).
function labelIcon(label: string) {
  const l = (label || "").toLowerCase();
  if (l === "home") return Home;
  if (l === "work") return Briefcase;
  return Bookmark;
}

export default function AddressBookModal({ isOpen, onClose }: Props) {
  const { profile, setActiveAddress, deleteAddress, isLoggedIn } = useUserStore();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setConfirmDeleteId(null);
  }, [isOpen]);

  // Esc closes the modal — but only when no nested modal is open, so the
  // customer's Esc first dismisses the confirm / edit sheet, then this
  // book. Consistent with how nested-modal stacks are supposed to feel.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (confirmDeleteId) return setConfirmDeleteId(null);
      if (formOpen) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose, confirmDeleteId, formOpen]);

  if (!isOpen) return null;

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setError(null);
    try {
      await deleteAddress(id);
      setConfirmDeleteId(null);
    } catch (err: any) {
      setError(err?.message || "Couldn't delete that address. Try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const openEdit = (addr: Address) => {
    setEditing(addr);
    setFormOpen(true);
  };
  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };

  // Real addresses only — the store keeps an EMPTY placeholder row when
  // the book is empty, and we don't want to render "No address selected"
  // as a manageable line item.
  const savedAddresses = profile.addresses.filter(
    (a) => a.id !== "addr_empty" && (a.houseNo || a.area)
  );

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="address-book-title"
        onClick={onClose}
      >
        <div
          className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <h2
                id="address-book-title"
                className="text-sm font-black text-slate-900 dark:text-white"
              >
                Address book
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {error && (
              <div
                role="alert"
                aria-live="assertive"
                className="flex items-start gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 p-3 text-xs font-semibold text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900"
              >
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {!isLoggedIn && (
              <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-3 text-xs font-semibold text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
                Guest addresses live only on this device. Sign in to save them across devices.
              </div>
            )}

            {savedAddresses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 mb-3">
                  <MapPin className="h-7 w-7" />
                </div>
                <p className="text-sm font-black text-slate-900 dark:text-white">
                  No saved addresses yet
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-[36ch]">
                  Add one now to skip the address form at every checkout.
                </p>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {savedAddresses.map((addr) => {
                  const isActive = profile.activeAddressId === addr.id;
                  const isConfirming = confirmDeleteId === addr.id;
                  const isDeleting = deletingId === addr.id;
                  const Icon = labelIcon(addr.label);
                  return (
                    <li
                      key={addr.id}
                      className={`rounded-2xl border p-3 transition-all ${
                        isActive
                          ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 shadow-sm"
                          : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Label + icon */}
                        <button
                          type="button"
                          onClick={() => setActiveAddress(addr.id)}
                          aria-label={`Use ${addr.label} address for delivery`}
                          className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 flex-shrink-0 active:scale-95"
                        >
                          <Icon className={`h-5 w-5 ${isActive ? "text-emerald-600 dark:text-emerald-400" : "text-slate-600 dark:text-slate-300"}`} />
                        </button>

                        {/* Address body — tap to set active */}
                        <button
                          type="button"
                          onClick={() => setActiveAddress(addr.id)}
                          className="flex-1 min-w-0 text-left"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-900 dark:text-white">
                              {addr.label}
                            </span>
                            {isActive && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">
                                <Check className="h-2.5 w-2.5" />
                                Active
                              </span>
                            )}
                            {addr.isDefault && !isActive && (
                              <span className="rounded-full bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                Default
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold mt-0.5 line-clamp-2">
                            {addr.houseNo}
                            {addr.area ? `, ${addr.area}` : ""}
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                            {[addr.city, addr.pincode].filter(Boolean).join(" · ")}
                          </p>
                          {addr.contactName && (
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                              For <b>{addr.contactName}</b>
                              {addr.contactPhone ? ` · ${addr.contactPhone}` : ""}
                            </p>
                          )}
                        </button>

                        {/* Actions */}
                        <div className="flex flex-col gap-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => openEdit(addr)}
                            aria-label={`Edit ${addr.label} address`}
                            className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(addr.id)}
                            aria-label={`Delete ${addr.label} address`}
                            className="flex h-11 w-11 items-center justify-center rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 active:scale-95"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Inline confirm — reveals under the row so the
                          customer sees exactly which address they're
                          about to remove. No detached global modal. */}
                      {isConfirming && (
                        <div className="mt-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 p-3 border border-rose-200 dark:border-rose-900">
                          <p className="text-xs font-semibold text-rose-800 dark:text-rose-300">
                            Delete this address? Your order history keeps
                            its own copy, so past orders aren&rsquo;t affected.
                          </p>
                          <div className="flex gap-2 mt-2.5">
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              disabled={isDeleting}
                              className="flex-1 h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-black text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 disabled:opacity-50"
                            >
                              Keep
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(addr.id)}
                              disabled={isDeleting}
                              className="flex-1 h-10 flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 text-xs font-black text-white shadow-sm hover:bg-rose-500 active:scale-95 disabled:opacity-50"
                            >
                              {isDeleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                              {isDeleting ? "Deleting…" : "Delete"}
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Footer — add button pinned so it never scrolls off */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={openAdd}
              className="w-full h-12 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-black text-white shadow-md hover:bg-emerald-500 active:scale-95"
            >
              <Plus className="h-4 w-4" />
              Add a new address
            </button>
          </div>
        </div>
      </div>

      {/* Add / edit sheet — reuses the existing full-fat address form
          with reverse-geocoding + GPS pin + validation. */}
      <AddressFormModal
        isOpen={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        initial={editing ?? undefined}
        onSaved={() => {
          // AddressFormModal already writes to the store; nothing more
          // to do here except close the form so the customer returns to
          // the updated list.
          setFormOpen(false);
          setEditing(null);
        }}
        onError={(msg) => setError(msg)}
      />
    </>
  );
}
