"use client";

import { useEffect, useState } from "react";
import { X, User as UserIcon, Mail, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useUserStore } from "@/store/useUserStore";

/**
 * "Your details" edit sheet.
 *
 * Lets the customer update the two mutable identity fields — name and
 * email. Phone is intentionally read-only: changing it means proving
 * ownership of the new number, which is a separate re-verification flow
 * that lives (or will live) at /auth. Showing it here as a disabled field
 * is honest — the customer sees why it's greyed out rather than being
 * left to wonder whether the app forgot how to display it.
 *
 * Optimistic write via useUserStore.updateProfile — the input reads back
 * the typed value instantly; on server rejection the store rolls back
 * and this component surfaces the error inline.
 */

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function EditProfileModal({ isOpen, onClose }: Props) {
  const { profile, updateProfile } = useUserStore();

  const [name, setName] = useState(profile.name || "");
  const [email, setEmail] = useState(profile.email || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Reset the form to the current profile every time the sheet reopens
  // — the customer may have cancelled a prior edit, so we don't want
  // stale local state.
  useEffect(() => {
    if (!isOpen) return;
    setName(profile.name || "");
    setEmail(profile.email || "");
    setError(null);
    setSaved(false);
  }, [isOpen, profile.name, profile.email]);

  // Close on Esc — audit finding "modal-escape". Backdrop click below
  // handles the other half.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const nameTrimmed = name.trim();
  const emailTrimmed = email.trim();
  // Match the server's Zod rules so the button state is honest — if the
  // client shows "Save enabled" we shouldn't get a 400 back.
  const nameValid = nameTrimmed.length >= 1 && nameTrimmed.length <= 80;
  const emailValid =
    emailTrimmed === "" ||
    (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed) && emailTrimmed.length <= 120);
  const dirty =
    nameTrimmed !== (profile.name || "").trim() ||
    emailTrimmed !== (profile.email || "").trim();
  const canSave = nameValid && emailValid && dirty && !busy;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      // Empty string here is the "clear this field" signal; the server
      // route treats "" as null (see PATCH handler).
      await updateProfile({
        name: nameTrimmed,
        email: emailTrimmed,
      });
      setSaved(true);
      // Keep the success chip visible briefly, then close so the customer
      // sees the updated header without a manual dismiss.
      setTimeout(() => onClose(), 900);
    } catch (err: any) {
      setError(err?.message || "Couldn't save your details. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-profile-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
          <h2
            id="edit-profile-title"
            className="text-sm font-black text-slate-900 dark:text-white"
          >
            Your details
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <label
              htmlFor="edit-name"
              className="block text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400"
            >
              Name
            </label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                id="edit-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="How should we address you?"
                maxLength={80}
                className="w-full h-12 pl-10 pr-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 outline-none"
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label
              htmlFor="edit-email"
              className="block text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400"
            >
              Email <span className="text-slate-400 font-medium normal-case">(for order receipts)</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                id="edit-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                maxLength={120}
                className="w-full h-12 pl-10 pr-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 outline-none"
              />
            </div>
            {!emailValid && emailTrimmed !== "" && (
              <p className="text-[11px] font-semibold text-rose-600" role="alert">
                That doesn&rsquo;t look like a valid email address.
              </p>
            )}
          </div>

          {/* Phone (read-only) */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Phone
            </label>
            <div className="flex h-12 items-center px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-sm font-mono font-bold text-slate-700 dark:text-slate-300">
              {profile.phone || "—"}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Changing your phone number needs a fresh OTP against the new number. Sign out and sign in again with it.
            </p>
          </div>

          {/* Error / success feedback — aria-live so screen readers hear
              the result without focus juggling. */}
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
          {saved && !error && (
            <div
              role="status"
              aria-live="polite"
              className="flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-3 text-xs font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Saved.</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="flex-1 h-12 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-black text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSave}
              className="flex-[1.5] h-12 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-black text-white shadow-md hover:bg-emerald-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
