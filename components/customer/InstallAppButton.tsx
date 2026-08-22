"use client";

import { useEffect, useState } from "react";
import { Download, X, Smartphone } from "lucide-react";

/**
 * Chrome / Edge / Samsung Internet on Android fire the `beforeinstallprompt`
 * event when the site meets PWA-install criteria (HTTPS + valid manifest +
 * user has interacted). We stash the event and expose a custom "Install app"
 * pill so users don't have to hunt for the browser's own install icon.
 *
 * On iOS Safari there's no equivalent event — we show a static "Add to Home
 * Screen" hint the first time the site is opened, dismissible forever.
 *
 * Dismissals persist in localStorage so the prompt isn't nagging.
 */

const DISMISS_KEY = "satyug_pwa_install_dismissed";

// TS doesn't ship a type for the deprecated-but-widely-used event
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export default function InstallAppButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Already dismissed forever?
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    // Already running as an installed PWA?
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (standalone) return;

    // iOS Safari has no install event — surface a static hint instead
    const ua = window.navigator.userAgent;
    const iOS = /iPhone|iPad|iPod/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    if (iOS) {
      setIsIOS(true);
      setVisible(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const installed = () => {
      setVisible(false);
      setDeferred(null);
    };
    window.addEventListener("appinstalled", installed);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") {
      setVisible(false);
    }
    setDeferred(null);
  };

  const dismissForever = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed left-3 right-3 z-30 rounded-2xl border border-emerald-200 bg-white shadow-lg md:hidden"
      style={{
        // Float just above the bottom nav (h-16) + safe area
        bottom: "calc(72px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div className="flex items-center gap-3 p-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
          <Smartphone className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-slate-900">
            {isIOS ? "Add 10minute to your Home Screen" : "Install 10minute on your phone"}
          </p>
          <p className="text-[11px] text-slate-500 line-clamp-1">
            {isIOS
              ? "Tap the Share icon, then ‘Add to Home Screen’."
              : "One-tap ordering, no browser tabs to hunt."}
          </p>
        </div>
        {!isIOS && (
          <button
            type="button"
            onClick={install}
            className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-[11px] font-black text-white hover:bg-emerald-500 active:scale-95"
          >
            <Download className="h-3.5 w-3.5" />
            Install
          </button>
        )}
        <button
          type="button"
          onClick={dismissForever}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
