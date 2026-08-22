"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, AlertTriangle, Loader2 } from "lucide-react";
import { useUserStore } from "@/store/useUserStore";

/**
 * Delete-account confirmation modal.
 *
 * Deleting an account is one of the few genuinely irreversible actions
 * in the app, so this deliberately makes the customer type a matching
 * phrase before the button enables — a small typing tax that turns
 * "oops I clicked delete" into "no, I actually meant that". Consistent
 * with how GitHub, Stripe, and Vercel handle equivalent flows.
 *
 * On success the server has already invalidated the session cookie and
 * anonymized the row; we clear the store and hard-navigate to /auth so
 * every route unmounts cleanly.
 */

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const CONFIRM_PHRASE = "delete my account";

export default function DeleteAccountModal({ isOpen, onClose }: Props) {
  const router = useRouter();
  const { deleteAccount } = useUserStore();
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setPhrase("");
    setError(null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose, busy]);

  if (!isOpen) return null;

  const canDelete = phrase.trim().toLowerCase() === CONFIRM_PHRASE && !busy;

  const handleDelete = async () => {
    if (!canDelete) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAccount();
      // Hard nav so every page component unmounts and any cached
      // in-memory data (cart drawer, orders list) is discarded.
      router.replace("/auth");
    } catch (err: any) {
      setError(err?.message || "Couldn't delete your account. Try again or contact support.");
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-account-title"
      onClick={busy ? undefined : onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-rose-200 dark:border-rose-900/60"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-rose-600" />
            <h2
              id="delete-account-title"
              className="text-sm font-black text-rose-700 dark:text-rose-400"
            >
              Delete your account
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed space-y-2">
            <p>
              Deleting your account will:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-400">
              <li>Remove your name, email, and saved addresses.</li>
              <li>Sign you out of every device.</li>
              <li>
                Keep your order history linked to a de-identified customer
                for accounting and refund purposes.
              </li>
              <li>Free up your phone number for a fresh signup later.</li>
            </ul>
            <p className="pt-1 font-bold text-slate-900 dark:text-white">
              This cannot be undone.
            </p>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="delete-phrase"
              className="block text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400"
            >
              To confirm, type <code className="font-mono normal-case text-rose-700 dark:text-rose-400">{CONFIRM_PHRASE}</code>
            </label>
            <input
              id="delete-phrase"
              type="text"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder={CONFIRM_PHRASE}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full h-12 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-mono text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/30 outline-none"
            />
          </div>

          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="rounded-xl bg-rose-50 dark:bg-rose-950/40 p-3 text-xs font-semibold text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900"
            >
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="flex-1 h-12 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-black text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 disabled:opacity-50"
            >
              Keep my account
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={!canDelete}
              className="flex-1 h-12 flex items-center justify-center gap-2 rounded-xl bg-rose-600 text-sm font-black text-white shadow-md hover:bg-rose-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? "Deleting…" : "Delete forever"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
