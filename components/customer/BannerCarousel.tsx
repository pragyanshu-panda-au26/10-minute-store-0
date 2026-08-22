"use client";

import { useEffect, useState } from "react";
import { Sparkles, ChevronLeft, ChevronRight, Tag } from "lucide-react";

interface Banner {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  code: string;
  imageUrl: string;
}

const GRADIENTS = [
  "from-emerald-900 via-teal-800 to-slate-950",
  "from-blue-900 via-indigo-900 to-slate-950",
  "from-purple-950 via-violet-900 to-slate-950",
  "from-rose-900 via-pink-900 to-slate-950",
];

export default function BannerCarousel() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    fetch("/api/banners")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.banners)) setBanners(data.banners);
      })
      .catch(() => { /* silent — banner is decorative */ });
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [banners.length]);

  if (banners.length === 0) {
    // Fallback tile so the page never looks empty before banners load
    return (
      <div className="relative overflow-hidden rounded-3xl p-5 sm:p-6 text-white shadow-xl border border-white/10 bg-gradient-to-r from-emerald-900 via-teal-800 to-slate-950 min-h-[145px] flex items-center">
        <div>
          <span className="flex items-center gap-1 rounded-full bg-amber-400/20 px-3 py-1 text-[11px] font-black text-amber-300 border border-amber-400/30 backdrop-blur-md w-fit">
            <Sparkles className="h-3.5 w-3.5" /> 10minute Store
          </span>
          <h2 className="mt-2.5 text-xl font-black tracking-tight sm:text-2xl text-white">
            Groceries in 10 minutes
          </h2>
          <p className="mt-1 text-xs text-slate-200 sm:text-sm">
            Fresh vegetables, fruits, dairy &amp; more — delivered by your neighbourhood owner.
          </p>
        </div>
      </div>
    );
  }

  const banner = banners[currentIndex];
  const gradient = GRADIENTS[currentIndex % GRADIENTS.length];

  return (
    <div
      className="relative overflow-hidden rounded-3xl p-5 sm:p-6 text-white shadow-xl transition-all duration-500 border border-white/10"
      style={
        banner.imageUrl
          ? {
              backgroundImage: `linear-gradient(90deg, rgba(2,6,23,0.85), rgba(2,6,23,0.3)), url(${banner.imageUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
    >
      {!banner.imageUrl && (
        <div className={`absolute inset-0 bg-gradient-to-r ${gradient}`} />
      )}

      <div className="relative z-10 flex flex-col justify-between min-h-[145px]">
        <div className="max-w-xl">
          <div className="flex flex-wrap items-center gap-2">
            {banner.badge && (
              <span className="flex items-center gap-1 rounded-full bg-amber-400/20 px-3 py-1 text-[11px] font-black text-amber-300 border border-amber-400/30 backdrop-blur-md">
                <Sparkles className="h-3.5 w-3.5" />
                {banner.badge}
              </span>
            )}
            {banner.code && (
              <span className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300 backdrop-blur-md border border-white/15">
                <Tag className="h-3 w-3 text-emerald-400" />
                Use code: <strong>{banner.code}</strong>
              </span>
            )}
          </div>
          <h2 className="mt-2.5 text-xl font-black tracking-tight sm:text-2xl text-white drop-shadow-xs">
            {banner.title}
          </h2>
          {banner.subtitle && (
            <p className="mt-1 text-xs text-slate-200 sm:text-sm leading-relaxed font-medium">
              {banner.subtitle}
            </p>
          )}
        </div>

        {banners.length > 1 && (
          <div className="mt-4 flex items-center justify-between pt-2">
            <div className="flex gap-1.5">
              {banners.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    idx === currentIndex ? "w-7 bg-white" : "w-2 bg-white/30 hover:bg-white/50"
                  }`}
                  aria-label={`Banner ${idx + 1}`}
                />
              ))}
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => setCurrentIndex((prev) => (prev === 0 ? banners.length - 1 : prev - 1))}
                className="rounded-full bg-black/30 p-2 text-white hover:bg-black/50 backdrop-blur-md"
                aria-label="Previous banner"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setCurrentIndex((prev) => (prev + 1) % banners.length)}
                className="rounded-full bg-black/30 p-2 text-white hover:bg-black/50 backdrop-blur-md"
                aria-label="Next banner"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
