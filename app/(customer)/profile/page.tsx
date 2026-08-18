"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUserStore, Address } from "@/store/useUserStore";
import { useThemeStore } from "@/store/useThemeStore";
import MobileBottomNav from "@/components/customer/MobileBottomNav";
import LocationPickerModal from "@/components/customer/LocationPickerModal";
import {
  ArrowLeft,
  User,
  ShoppingBag,
  Wallet,
  HelpCircle,
  Smartphone,
  Sun,
  Moon,
  EyeOff,
  BookOpen,
  Utensils,
  Heart,
  FileText,
  Gift,
  ClipboardList,
  CreditCard,
  Award,
  Sparkles,
  Share2,
  Info,
  Store,
  ShieldCheck,
  Bell,
  ChevronRight,
  LogOut,
} from "lucide-react";

export default function ProfilePage() {
  const router = useRouter();
  const {
    profile,
    addAddress,
    updateAddress,
    deleteAddress,
    signOut,
  } = useUserStore();

  const { theme, setTheme, initTheme } = useThemeStore();

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [sensitiveItemsHidden, setSensitiveItemsHidden] = useState(true);
  const [walletBalance] = useState(50);

  const handleSignOut = () => {
    if (confirm("Are you sure you want to sign out of your 10minute account?")) {
      signOut();
      router.push("/auth");
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-32 transition-colors">
      {/* Yellow Top Banner & Profile Header */}
      <div className="relative bg-gradient-to-b from-[#F8CB46] via-[#F8CB46]/40 to-slate-100/70 dark:to-slate-950 pt-4 pb-6 px-4 text-center">
        {/* Top Circular Back Button */}
        <button
          onClick={() => router.back()}
          className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm hover:bg-slate-50 active:scale-95 transition-all cursor-pointer border border-slate-200 dark:border-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        {/* Large Centered Avatar */}
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-white dark:bg-slate-900 shadow-md border-4 border-white dark:border-slate-800 text-slate-800 dark:text-slate-100 my-2">
          <User className="h-12 w-12 text-slate-800 dark:text-slate-200" />
        </div>

        <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Your account</h1>
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-0.5 font-mono">
          {profile.phone || "8860269736"}
        </p>
      </div>

      <main className="mx-auto max-w-xl px-4 space-y-4 -mt-1">
        {/* TOP 3 QUICK ACTION CARDS GRID */}
        <div className="grid grid-cols-3 gap-2.5">
          {/* 1. Your Orders */}
          <Link
            href="/orders"
            className="flex flex-col items-center justify-center rounded-2xl bg-white dark:bg-slate-900 p-3.5 shadow-xs border border-slate-200/60 dark:border-slate-800 hover:border-slate-300 transition-all cursor-pointer active:scale-95"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 mb-1.5">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-slate-900 dark:text-white">Your orders</span>
          </Link>

          {/* 2. 10minute Money */}
          <div
            onClick={() => alert(`Your 10minute Money Wallet balance is ₹${walletBalance}`)}
            className="flex flex-col items-center justify-center rounded-2xl bg-white dark:bg-slate-900 p-3.5 shadow-xs border border-slate-200/60 dark:border-slate-800 hover:border-slate-300 transition-all cursor-pointer active:scale-95"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mb-1.5">
              <Wallet className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-slate-900 dark:text-white truncate">10minute Mon...</span>
          </div>

          {/* 3. Need Help */}
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
          {/* App Update Card */}
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

          {/* APPEARANCE THEME SELECTOR ROW (LIGHT / DARK SWITCH) */}
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

            {/* LIGHT vs DARK Mode Selector Segment */}
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

          {/* Sensitive Items Toggle Card */}
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

        {/* SECTION 1: YOUR INFORMATION */}
        <div className="space-y-1.5">
          <h2 className="px-1 text-xs font-extrabold text-slate-900 dark:text-white">Your information</h2>
          <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/80 shadow-xs overflow-hidden text-xs font-bold text-slate-800 dark:text-slate-200">
            <button
              onClick={() => setIsLocationModalOpen(true)}
              className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <BookOpen className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                <span>Address book</span>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </button>

            <div className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <Utensils className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                <span>Bookmarked recipes</span>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </div>

            <div className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <Heart className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                <span>Your wishlist</span>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </div>

            <div className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                <span>GST details</span>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </div>

            <div className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <Gift className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                <span>E-gift cards</span>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </div>

            <div className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <ClipboardList className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                <span>Your prescriptions</span>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </div>
          </div>
        </div>

        {/* SECTION 2: PAYMENT AND COUPONS */}
        <div className="space-y-1.5">
          <h2 className="px-1 text-xs font-extrabold text-slate-900 dark:text-white">Payment and coupons</h2>
          <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/80 shadow-xs overflow-hidden text-xs font-bold text-slate-800 dark:text-slate-200">
            <div className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <Wallet className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                <span>10minute Money</span>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </div>

            <div className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <CreditCard className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                <span>Payment settings</span>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </div>

            <div className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <Gift className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                <span>Claim Gift card</span>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </div>

            <div className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <Award className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                <span>Your collected rewards</span>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </div>
          </div>
        </div>

        {/* SECTION 3: VELOZ FOUNDATION */}
        <div className="space-y-1.5">
          <h2 className="px-1 text-xs font-extrabold text-slate-900 dark:text-white">Veloz Foundation</h2>
          <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/80 shadow-xs overflow-hidden text-xs font-bold text-slate-800 dark:text-slate-200">
            <div className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <Sparkles className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                <span>Feeding India impact</span>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </div>

            <div className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                <span>Get donation receipt</span>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </div>
          </div>
        </div>

        {/* SECTION 4: OTHER INFORMATION */}
        <div className="space-y-1.5">
          <h2 className="px-1 text-xs font-extrabold text-slate-900 dark:text-white">Other Information</h2>
          <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/80 shadow-xs overflow-hidden text-xs font-bold text-slate-800 dark:text-slate-200">
            <div className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <Share2 className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                <span>Share the app</span>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </div>

            <div className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <Info className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                <span>About us</span>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </div>

            <div className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <Store className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                <span>Sell on 10minute</span>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </div>

            <div className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                <span>Account privacy</span>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </div>

            <div className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <Bell className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                <span>Notification preferences</span>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </div>

            {/* Sign Out Row */}
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
          </div>
        </div>

        {/* LEGAL DISCLAIMER FOOTER */}
        <div className="text-center pt-2 pb-4 space-y-1">
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">10minute store v18.19.0</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            Operating under Veloz Technologies Private Limited
          </p>
        </div>
      </main>

      {/* Location Picker Sheet */}
      <LocationPickerModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
      />

      <MobileBottomNav />
    </div>
  );
}
