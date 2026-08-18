"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, Clock, TrendingUp, Sparkles } from "lucide-react";
import type { ExtendedProduct } from "@/lib/dummyData";

/**
 * Blinkit-style search bar with:
 *   • Live suggestions from the catalog (case-insensitive, name / tag / brand)
 *   • "Recent searches" pill list (localStorage)
 *   • "Trending" fallback pill list (client-derived: top-rated products)
 *   • Suggestion tap → sets query AND fires `onSubmit`
 */

interface SmartSearchBarProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: (q: string) => void;
  products: ExtendedProduct[];
  className?: string;
  placeholder?: string;
}

const RECENT_KEY = "satyug_recent_searches_v1";
const RECENT_MAX = 8;

export default function SmartSearchBar({
  value,
  onChange,
  onSubmit,
  products,
  className,
  placeholder = "Search for atta, dal, milk, chips…",
}: SmartSearchBarProps) {
  const [focused, setFocused] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (raw) setRecent(JSON.parse(raw));
    } catch {}
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!focused) return;
    const handler = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [focused]);

  const trimmed = value.trim().toLowerCase();

  // Client-side suggestions: fuzzy match name / brand / tags. Cheap for ~100
  // products; if the catalog grows past a few thousand, move to /api/products?q=.
  const suggestions = useMemo(() => {
    if (trimmed.length < 1) return [];
    const scored = products
      .map((p) => {
        const name = p.name.toLowerCase();
        const brand = (p.brand || "").toLowerCase();
        const tags = (p.tags || []).map((t) => t.toLowerCase());
        let score = 0;
        if (name.startsWith(trimmed)) score += 100;
        else if (name.includes(trimmed)) score += 40;
        if (brand.startsWith(trimmed)) score += 60;
        else if (brand.includes(trimmed)) score += 20;
        if (tags.some((t) => t.startsWith(trimmed))) score += 30;
        else if (tags.some((t) => t.includes(trimmed))) score += 10;
        return { p, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((x) => x.p);
    return scored;
  }, [trimmed, products]);

  // "Trending" fallback: highest-rated in stock
  const trending = useMemo(
    () =>
      products
        .filter((p) => (p.stock ?? 0) > 0)
        .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
        .slice(0, 6),
    [products]
  );

  const commit = (q: string) => {
    const clean = q.trim();
    if (!clean) return;
    onChange(clean);
    onSubmit?.(clean);
    setFocused(false);
    // Save to recent (dedup, cap)
    setRecent((prev) => {
      const next = [clean, ...prev.filter((x) => x.toLowerCase() !== clean.toLowerCase())].slice(
        0,
        RECENT_MAX
      );
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const clearRecent = () => {
    setRecent([]);
    try { localStorage.removeItem(RECENT_KEY); } catch {}
  };

  const showPanel = focused;
  const showSuggestions = trimmed.length >= 1 && suggestions.length > 0;
  const showRecent = trimmed.length < 1 && recent.length > 0;
  const showTrending = trimmed.length < 1 && trending.length > 0;

  return (
    <div ref={wrapperRef} className={`relative ${className ?? ""}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit(value);
            else if (e.key === "Escape") setFocused(false);
          }}
          placeholder={placeholder}
          className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none shadow-xs"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {showPanel && (showSuggestions || showRecent || showTrending) && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-40 max-h-[70vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
          {showSuggestions && (
            <div className="p-2">
              <div className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Suggestions
              </div>
              {suggestions.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => commit(p.name)}
                  className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left hover:bg-slate-50"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.imageUrl}
                    alt=""
                    className="h-8 w-8 rounded-md object-cover bg-slate-100"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 line-clamp-1">
                      {p.name}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      ₹{p.price} · {p.weight}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {showRecent && (
            <div className="p-2 border-t border-slate-100">
              <div className="flex items-center justify-between px-2 py-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Recent
                </span>
                <button
                  type="button"
                  onClick={clearRecent}
                  className="text-[10px] font-bold text-slate-500 hover:text-slate-800"
                >
                  Clear
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 px-2 pt-1">
                {recent.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => commit(r)}
                    className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {showTrending && (
            <div className="p-2 border-t border-slate-100">
              <div className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> Trending
              </div>
              <div className="flex flex-wrap gap-1.5 px-2 pt-1">
                {trending.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => commit(p.name)}
                    className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
