"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUserStore } from "@/store/useUserStore";
import { useThemeStore } from "@/store/useThemeStore";
import MobileBottomNav from "@/components/customer/MobileBottomNav";
import LocationPickerModal from "@/components/customer/LocationPickerModal";
import AddressBookModal from "@/components/customer/AddressBookModal";
import EditProfileModal from "@/components/customer/EditProfileModal";
import DeleteAccountModal from "@/components/customer/DeleteAccountModal";
import { useOrderPushSubscription } from "@/components/customer/useOrderPushSubscription";
import {
  ArrowLeft,
  User,
  ShoppingBag,
  HelpCircle,
  Smartphone,
  Sun,
  Moon,
  EyeOff,
  BookOpen,
  Bell,
  BellOff,
  Loader2,
  ChevronRight,
  LogOut,
  Pencil,
  Trash2,
} from "lucide-react";

/**
 * Profile / account screen.
 *
 * Only rows backed by real functionality are rendered. The following rows were
 * removed because they were pure hover/cursor placeholders with no click
 * handler and no destination:
 *   Bookmarked recipes, Wishlist, GST details, E-gift cards, Prescriptions,
 *   10minute Money, Payment settings, Claim Gift card, Rewards,
 *   Feeding India, Donation receipt, Share app, About us, Sell on 10minute,
 *   Account privacy, Notification preferences.
 * The "10minute Money" quick-action tile at the top was removed with them,
 * and the top action grid collapsed from 3 tiles to 2.
 */
export default function ProfilePage() {
  const router = useRouter();
  const { profile, isLoggedIn, signOut } = useUserStore();
  const push = useOrderPushSubscription();

  const { theme, setTheme, initTheme } = useThemeStore();

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isAddressBookOpen, setIsAddressBookOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false);
  const [sensitiveItemsHidden, setSensitiveItemsHidden] = useState(true);

  const handleSignOut = () => {
    if (confirm("Sign out of your 10minute account?")) {
      signOut();
      router.push("/auth");
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-32 transition-colors">
      {/* Yellow Top Banner & Profile Header */}
      <div className="relative bg-gradient-to-b from-[#F8CB46] via-[#F8CB46]/40 to-slate-100/70 dark:to-slate-950 pt-4 pb-6 px-4 text-center">
        <button
          onClick={() => router.back()}
          className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm hover:bg-slate-50 active:scale-95 transition-all cursor-pointer border border-slate-200 dark:border-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-white dark:bg-slate-900 shadow-md border-4 border-white dark:border-slate-800 text-slate-800 dark:text-slate-100 my-2">
          <User className="h-12 w-12 text-slate-800 dark:text-slate-200" />
        </div>

        {/* Customer name (or a friendly stand-in) headlines the account
            card; the phone becomes the secondary line and the email
            appears below that when set. The Edit affordance sits inline
            so the customer knows it's tap-to-change, not read-only. */}
        <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
          {profile.name?.trim() || (isLoggedIn ? "Add your name" : "Not signed in")}
        </h1>
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5 font-mono">
          {profile.phone || "—"}
        </p>
        {profile.email && (
          <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 mt-0.5">
            {profile.email}
          </p>
        )}
        {isLoggedIn && (
          <button
            type="button"
            onClick={() => setIsEditProfileOpen(true)}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white dark:bg-slate-900 px-3 py-1.5 text-[11px] font-black text-slate-800 dark:text-slate-200 shadow-sm border border-slate-200 dark:border-slate-800 hover:border-emerald-400 active:scale-95 transition-all"
          >
            <Pencil className="h-3 w-3" />
            Edit details
          </button>
        )}
      </div>

      <main className="mx-auto max-w-xl px-4 space-y-4 -mt-1">
        {/* TOP QUICK ACTION CARDS — 2 tiles now that 10minute Money is gone. */}
        <div className="grid grid-cols-2 gap-2.5">
          <Link
            href="/orders"
            className="flex flex-col items-center justify-center rounded-2xl bg-white dark:bg-slate-900 p-3.5 shadow-xs border border-slate-200/60 dark:border-slate-800 hover:border-slate-300 transition-all cursor-pointer active:scale-95"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 mb-1.5">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-slate-900 dark:text-white">Your orders</span>
          </Link>

          <Link
            href="/support"
            className="flex flex-col items-center justify-center rounded-2xl bg-white dark:bg-slate-900 p-3.5 shadow-xs border border-slate-200/60 dark:border-slate-800 hover:border-slate-300 transition-all cursor-pointer active:scale-95"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 mb-1.5">
              <HelpCircle className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-slate-900 dark:text-white">Need help?</span>
          </Link>
        </div>

        {/* APP SETTINGS & PREFERENCES CARDS */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-xs border border-slate-200/60 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                <Smartphone className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-slate-900 dark:text-white">App update available</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">bug fixes and improvements</p>
              </div>
            </div>
            <span className="rounded-full bg-emerald-50 dark:bg-emerald-950 px-2.5 py-1 text-[10px] font-mono font-black text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              v18.19.0
            </span>
          </div>

          {/* Appearance theme switch */}
          <div className="flex items-center justify-between rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-xs border border-slate-200/60 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-amber-500 dark:text-purple-400">
                {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-slate-900 dark:text-white">Appearance</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  {theme === "dark" ? "Dark Mode active" : "Light Mode active"}
                </p>
              </div>
            </div>

            <div className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-black transition-all cursor-pointer ${
                  theme === "light"
                    ? "bg-white text-slate-950 shadow-xs"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                <Sun className="h-3 w-3 text-amber-500" />
                <span>LIGHT</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-black transition-all cursor-pointer ${
                  theme === "dark"
                    ? "bg-slate-950 text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                <Moon className="h-3 w-3 text-purple-400" />
                <span>DARK</span>
              </button>
            </div>
          </div>

          {/* Sensitive items visibility toggle (local UI-only preference) */}
          <div className="flex items-center justify-between rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-xs border border-slate-200/60 dark:border-slate-800">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5">
                <EyeOff className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-slate-900 dark:text-white">Sensitive items hidden</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium max-w-[210px] leading-snug">
                  Sexual wellness, nicotine products and other sensitive items are hidden
                </p>
                <button
                  onClick={() => setSensitiveItemsHidden(!sensitiveItemsHidden)}
                  className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 underline mt-0.5"
                >
                  Edit details
                </button>
              </div>
            </div>

            <button
              onClick={() => setSensitiveItemsHidden(!sensitiveItemsHidden)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                sensitiveItemsHidden ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-700"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  sensitiveItemsHidden ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {/* NOTIFICATIONS — web-push toggle for order status updates.
            Hidden entirely on browsers that don't support push (older iOS
            Safari, WebViews without notification API). Also hidden for
            guests, since a subscription without a signed-in customerId
            would land in the DB with no one to fan out to. */}
        {isLoggedIn && push.supported && (
          <div className="flex items-center justify-between rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-xs border border-slate-200/60 dark:border-slate-800">
            <div className="flex items-start gap-3">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0 mt-0.5 ${
                  push.subscribed
                    ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                }`}
              >
                {push.subscribed ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-slate-900 dark:text-white">
                  Order updates
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium max-w-[220px] leading-snug">
                  {push.status === "denied"
                    ? "Notifications blocked. Turn them on in your browser's site settings for this page."
                    : push.subscribed
                      ? "You'll get a native notification when your order status changes."
                      : "Get a notification the moment your order is packed, out for delivery, or delivered."}
                </p>
              </div>
            </div>

            {/* Toggle button. Disabled while permission is denied — that
                requires the customer to fix it in browser settings, not
                something we can trigger from JS. */}
            <button
              onClick={() => (push.subscribed ? push.disable() : push.enable())}
              disabled={push.busy || push.status === "denied"}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
                push.subscribed ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-700"
              }`}
              aria-label={push.subscribed ? "Turn off order notifications" : "Turn on order notifications"}
            >
              {push.busy ? (
                <span className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-3 w-3 animate-spin text-white" />
                </span>
              ) : (
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    push.subscribed ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              )}
            </button>
          </div>
        )}

        {/* YOUR INFORMATION — Address book now opens the proper CRUD
            surface (list + add + edit + delete), not the quick-pick
            LocationPickerModal. That modal is still used from the
            header's location switcher where "pick where to deliver" is
            the actual job. */}
        <div className="space-y-1.5">
          <h2 className="px-1 text-xs font-extrabold text-slate-900 dark:text-white">Your information</h2>
          <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/80 shadow-xs overflow-hidden text-xs font-bold text-slate-800 dark:text-slate-200">
            <button
              onClick={() => setIsAddressBookOpen(true)}
              className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <BookOpen className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                <div className="flex flex-col">
                  <span>Address book</span>
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 tracking-normal normal-case">
                    {profile.addresses.filter(a => a.id !== "addr_empty" && (a.houseNo || a.area)).length} saved
                  </span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </button>
          </div>
        </div>

        {/* ACCOUNT — Sign out + Delete account. Both are irreversible-ish
            (sign-out is a click to reverse; delete is genuinely one-way),
            so they share a card with a divider and delete carries a
            confirmation modal that requires typing a phrase. */}
        {isLoggedIn && (
          <div className="space-y-1.5">
            <h2 className="px-1 text-xs font-extrabold text-slate-900 dark:text-white">Account</h2>
            <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/80 shadow-xs overflow-hidden text-xs font-bold text-slate-800 dark:text-slate-200">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center justify-between p-3.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors text-left cursor-pointer"
              >
                <div className="flex items-center gap-3 font-extrabold">
                  <LogOut className="h-4 w-4 text-rose-600" />
                  <span>Sign out</span>
                </div>
                <ChevronRight className="h-4 w-4 text-rose-400" />
              </button>
              <button
                onClick={() => setIsDeleteAccountOpen(true)}
                className="w-full flex items-center justify-between p-3.5 text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors text-left cursor-pointer"
              >
                <div className="flex items-center gap-3 font-extrabold">
                  <Trash2 className="h-4 w-4 text-rose-700" />
                  <span>Delete account</span>
                </div>
                <ChevronRight className="h-4 w-4 text-rose-400" />
              </button>
            </div>
          </div>
        )}

        <div className="text-center pt-2 pb-4 space-y-1">
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">10minute store v18.19.0</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            Operated by Veloz Technologies Private Limited
          </p>
        </div>
      </main>

      <LocationPickerModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
      />
      <AddressBookModal
        isOpen={isAddressBookOpen}
        onClose={() => setIsAddressBookOpen(false)}
      />
      <EditProfileModal
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
      />
      <DeleteAccountModal
        isOpen={isDeleteAccountOpen}
        onClose={() => setIsDeleteAccountOpen(false)}
      />

      <MobileBottomNav />
    </div>
  );
}
