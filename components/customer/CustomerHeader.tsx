"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin, Search, Zap, ShoppingBag, User, ChevronDown, Locate, Mic } from "lucide-react";
import { useCartStore } from "@/store/useCartStore";
import { useUserStore } from "@/store/useUserStore";
import LocationPickerModal from "@/components/customer/LocationPickerModal";

interface CustomerHeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export default function CustomerHeader({
  searchQuery,
  setSearchQuery,
}: CustomerHeaderProps) {
  const { getTotalItems } = useCartStore();
  const totalItems = getTotalItems();

  const { profile, getActiveAddress } = useUserStore();
  const activeAddr = getActiveAddress();

  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  return (
    <>
      {/* Express Yellow Blinkit Mobile & Clean Modern Desktop Header */}
      <header className="sticky top-0 z-30 bg-[#F8CB46] md:bg-white/95 md:backdrop-blur-xl border-b border-amber-300 md:border-slate-200 shadow-xs transition-colors">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
            
            {/* TOP BAR: BRAND + LOCATION + USER AVATAR */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                {/* Brand Emblem */}
                <Link
                  href="/"
                  className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-950 text-white font-black text-xs tracking-tighter hover:scale-105 transition-transform flex-shrink-0"
                >
                  10m
                </Link>
                <div>
                  {/* Headline */}
                  <div className="flex items-center gap-1.5">
                    <Link href="/" className="text-sm sm:text-base font-black tracking-tight text-slate-950">
                      10minute in <span className="font-black text-slate-950">10 minutes</span>
                    </Link>
                  </div>

                  {/* Delivery Location Trigger */}
                  <button
                    onClick={() => setIsLocationModalOpen(true)}
                    className="flex items-center gap-1 text-[11px] text-slate-900 font-extrabold hover:underline text-left group cursor-pointer"
                  >
                    <span suppressHydrationWarning className="font-black uppercase tracking-wider text-slate-900">
                      {activeAddr.label} -
                    </span>
                    <span suppressHydrationWarning className="truncate text-slate-900 max-w-[130px] sm:max-w-[180px] font-bold">
                      {activeAddr.area}, {activeAddr.city}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-slate-950 flex-shrink-0" />
                  </button>
                </div>
              </div>

              {/* Mobile Right Controls: Circular User Profile Pill & Cart Count */}
              <div className="flex items-center gap-2 md:hidden">
                <Link
                  href="/profile"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-950 shadow-xs border border-amber-300"
                >
                  <User className="h-4 w-4 text-slate-950" />
                </Link>
                <Link href="/cart" className="relative flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-xs">
                  <ShoppingBag className="h-4 w-4 text-white" />
                  {totalItems > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[9px] font-black text-slate-950 shadow-2xs">
                      {totalItems}
                    </span>
                  )}
                </Link>
              </div>
            </div>

            {/* INTEGRATED SEARCH BAR (White Embedded Input Container) */}
            <div className="relative flex-1 md:max-w-xl md:mx-auto w-full">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                <Search className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder='Search "ice-cream", "tomatoes", "milk"...'
                className="w-full rounded-2xl border border-slate-200/90 bg-white py-2.5 pl-10 pr-9 text-xs font-bold text-slate-900 placeholder-slate-400 transition-all focus:border-slate-950 focus:bg-white focus:outline-none focus:ring-4 focus:ring-slate-950/10 shadow-sm"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                {searchQuery ? (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="text-xs font-black text-slate-400 hover:text-slate-900"
                  >
                    Clear
                  </button>
                ) : (
                  <Mic className="h-4 w-4 text-slate-400" />
                )}
              </div>
            </div>

            {/* DESKTOP RIGHT CONTROLS */}
            <div className="hidden md:flex items-center justify-end gap-3 flex-shrink-0">
              <button
                onClick={() => setIsLocationModalOpen(true)}
                className="flex items-center gap-1.5 rounded-2xl bg-slate-950 px-3.5 py-2 text-xs font-black text-white hover:bg-slate-800 transition-all active:scale-95 shadow-2xs cursor-pointer"
              >
                <Locate className="h-3.5 w-3.5 text-emerald-400" />
                <span>GPS Location</span>
              </button>

              <Link
                href="/profile"
                className="flex items-center gap-2 rounded-2xl bg-slate-950 text-white border border-slate-800 px-3.5 py-2 text-xs font-bold hover:bg-slate-900 transition-all active:scale-95 cursor-pointer"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-slate-950 text-[10px] font-bold shadow-xs">
                  <User className="h-3.5 w-3.5 text-slate-950" />
                </div>
                <span className="font-extrabold text-white max-w-[100px] truncate">
                  {profile.name.split(" ")[0]}
                </span>
              </Link>
            </div>

          </div>
        </div>
      </header>

      {/* Touch-Optimized Mobile Location Picker Modal */}
      <LocationPickerModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
      />
    </>
  );
}
