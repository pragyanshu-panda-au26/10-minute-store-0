"use client";

import { useMemo, useState } from "react";
import { ChevronDown, SlidersHorizontal, X, Leaf, Check } from "lucide-react";
import type { ExtendedProduct } from "@/lib/dummyData";

export type SortKey =
  | "popularity"
  | "price_asc"
  | "price_desc"
  | "discount_desc"
  | "newest";

export interface Filters {
  vegOnly: boolean;
  brands: string[];
  priceMax: number | null; // rupees; null = no cap
}

export const DEFAULT_FILTERS: Filters = {
  vegOnly: false,
  brands: [],
  priceMax: null,
};

export const DEFAULT_SORT: SortKey = "popularity";

/**
 * Applies sort + filters to a product list. Pure function so both the bar
 * and the parent page can call it without duplicated logic.
 */
export function applySortFilters(
  products: ExtendedProduct[],
  sort: SortKey,
  filters: Filters
): ExtendedProduct[] {
  let out = products.slice();

  if (filters.vegOnly) out = out.filter((p) => (p as any).isVeg !== false);
  if (filters.brands.length > 0)
    out = out.filter((p) => filters.brands.includes(((p as any).brand || "").trim()));
  if (filters.priceMax != null)
    out = out.filter((p) => p.price <= (filters.priceMax as number));

  switch (sort) {
    case "price_asc":
      out.sort((a, b) => a.price - b.price);
      break;
    case "price_desc":
      out.sort((a, b) => b.price - a.price);
      break;
    case "discount_desc":
      out.sort((a, b) => {
        const da = a.originalPrice ? (a.originalPrice - a.price) / a.originalPrice : 0;
        const db = b.originalPrice ? (b.originalPrice - b.price) / b.originalPrice : 0;
        return db - da;
      });
      break;
    case "newest":
      // We don't have createdAt on the client type; use id as a stable-ish proxy
      out.sort((a, b) => (a.id > b.id ? -1 : 1));
      break;
    case "popularity":
    default:
      out.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  }
  return out;
}

const SORT_LABELS: Record<SortKey, string> = {
  popularity: "Popularity",
  price_asc: "Price: low → high",
  price_desc: "Price: high → low",
  discount_desc: "Discount",
  newest: "What's new",
};

const PRICE_BUCKETS = [
  { label: "Under ₹50", value: 50 },
  { label: "Under ₹100", value: 100 },
  { label: "Under ₹250", value: 250 },
  { label: "Under ₹500", value: 500 },
];

interface SortFilterBarProps {
  products: ExtendedProduct[]; // full catalog — used to derive brand chips
  sort: SortKey;
  onSortChange: (s: SortKey) => void;
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
  className?: string;
}

export default function SortFilterBar({
  products,
  sort,
  onSortChange,
  filters,
  onFiltersChange,
  className,
}: SortFilterBarProps) {
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const brands = useMemo(
    () =>
      Array.from(
        new Set(
          products
            .map((p) => ((p as any).brand || "").trim())
            .filter((b): b is string => b.length > 0)
        )
      ).sort(),
    [products]
  );

  const activeFilterCount =
    (filters.vegOnly ? 1 : 0) +
    (filters.brands.length > 0 ? 1 : 0) +
    (filters.priceMax != null ? 1 : 0);

  const toggleBrand = (b: string) => {
    onFiltersChange({
      ...filters,
      brands: filters.brands.includes(b)
        ? filters.brands.filter((x) => x !== b)
        : [...filters.brands, b],
    });
  };

  return (
    <>
      <div className={`flex items-center gap-2 overflow-x-auto no-scrollbar ${className ?? ""}`}>
        {/* Sort */}
        <div className="relative">
          <button
            type="button"
            onClick={() => { setSortOpen((v) => !v); setFilterOpen(false); }}
            className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:border-slate-300"
          >
            Sort · <span className="text-slate-500">{SORT_LABELS[sort]}</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${sortOpen ? "rotate-180" : ""}`} />
          </button>
          {sortOpen && (
            <div className="absolute left-0 top-full mt-1.5 z-30 min-w-[180px] rounded-2xl border border-slate-200 bg-white p-1 shadow-xl">
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => { onSortChange(k); setSortOpen(false); }}
                  className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold text-left ${
                    sort === k ? "bg-emerald-50 text-emerald-800" : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {SORT_LABELS[k]}
                  {sort === k && <Check className="h-3.5 w-3.5" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Filters trigger */}
        <button
          type="button"
          onClick={() => { setFilterOpen(true); setSortOpen(false); }}
          className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:border-slate-300"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filter
          {activeFilterCount > 0 && (
            <span className="rounded-full bg-emerald-600 px-1.5 py-0 text-[10px] font-black text-white">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Inline active-filter chips (removable) */}
        {filters.vegOnly && (
          <FilterChip label="Veg only" onRemove={() => onFiltersChange({ ...filters, vegOnly: false })} />
        )}
        {filters.priceMax != null && (
          <FilterChip
            label={`Under ₹${filters.priceMax}`}
            onRemove={() => onFiltersChange({ ...filters, priceMax: null })}
          />
        )}
        {filters.brands.map((b) => (
          <FilterChip key={b} label={b} onRemove={() => toggleBrand(b)} />
        ))}
      </div>

      {/* Filter sheet */}
      {filterOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => setFilterOpen(false)} />
          <div className="relative z-10 w-full sm:max-w-md sm:mx-4 bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-black text-slate-900">Filters</h2>
              <button
                onClick={() => setFilterOpen(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {/* Veg */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Dietary
                </p>
                <button
                  type="button"
                  onClick={() => onFiltersChange({ ...filters, vegOnly: !filters.vegOnly })}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                    filters.vegOnly
                      ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                      : "border-slate-200 text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <Leaf className="h-3.5 w-3.5 text-emerald-600" /> Vegetarian only
                </button>
              </div>

              {/* Price */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Price
                </p>
                <div className="flex flex-wrap gap-2">
                  {PRICE_BUCKETS.map((b) => {
                    const active = filters.priceMax === b.value;
                    return (
                      <button
                        key={b.value}
                        type="button"
                        onClick={() =>
                          onFiltersChange({
                            ...filters,
                            priceMax: active ? null : b.value,
                          })
                        }
                        className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-all ${
                          active
                            ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                            : "border-slate-200 text-slate-700 hover:border-slate-300"
                        }`}
                      >
                        {b.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Brand */}
              {brands.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Brand
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {brands.map((b) => {
                      const active = filters.brands.includes(b);
                      return (
                        <button
                          key={b}
                          type="button"
                          onClick={() => toggleBrand(b)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-all ${
                            active
                              ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                              : "border-slate-200 text-slate-700 hover:border-slate-300"
                          }`}
                        >
                          {b}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 border-t border-slate-100 bg-white px-5 py-3">
              <button
                type="button"
                onClick={() => onFiltersChange(DEFAULT_FILTERS)}
                className="flex-1 rounded-2xl border border-slate-200 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Reset all
              </button>
              <button
                type="button"
                onClick={() => setFilterOpen(false)}
                className="flex-1 rounded-2xl bg-emerald-600 py-3 text-sm font-extrabold text-white shadow hover:bg-emerald-500"
              >
                Show results
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800 whitespace-nowrap">
      {label}
      <button type="button" onClick={onRemove} className="hover:text-emerald-950">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
