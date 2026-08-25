"use client";

/**
 * Blinkit-style category detail split view.
 *
 * Left  — vertical scroll rail of L2 subcategory tiles (image + label).
 *         Active tile is marked with an emerald left-border + bold emerald
 *         label, matching Blinkit's convention exactly.
 * Right — 2-column product grid for the currently-selected L2, with a
 *         filters / sort chip row pinned above it.
 *
 * We derive the tile image for each subcategory from the first product in
 * that shelf — no separate asset needed. Falls back to a category emoji
 * when the shelf is truly empty.
 *
 * Rendered inside /c/[id]. On mobile this is the whole category viewport;
 * on desktop we hide it and rely on the existing sidebar-driven grid on the
 * home page.
 */

import Image from "next/image";
import { useState } from "react";
import { Category, ExtendedProduct } from "@/lib/dummyData";
import ProductCard from "./ProductCard";
import { SlidersHorizontal, ArrowDownUp, IndianRupee, Tags } from "lucide-react";

interface Props {
  category: Category;
  selectedSubcategory: string;
  onSelectSubcategory: (name: string) => void;
  products: ExtendedProduct[]; // already filtered to this L1
  onSelectPdpProduct: (p: ExtendedProduct) => void;
}

export default function MobileCategorySplitView({
  category,
  selectedSubcategory,
  onSelectSubcategory,
  products,
  onSelectPdpProduct,
}: Props) {
  // First product image per subcategory — used as the tile's thumbnail. We
  // walk the whole list once and take the first hit; keeps the rail visually
  // representative of what actually ships from that shelf.
  const imageBySubcategory = new Map<string, string>();
  for (const p of products) {
    if (p.subcategory && !imageBySubcategory.has(p.subcategory)) {
      imageBySubcategory.set(p.subcategory, p.imageUrl);
    }
  }
  const countBySubcategory = new Map<string, number>();
  for (const p of products) {
    if (!p.subcategory) continue;
    countBySubcategory.set(
      p.subcategory,
      (countBySubcategory.get(p.subcategory) ?? 0) + 1
    );
  }

  // "All Items" is a synthetic subcategory that shows every product in the
  // L1 — mirrors Blinkit's default landing state when you tap a category.
  const isAll = !selectedSubcategory || selectedSubcategory === "All Items";
  const rightPaneProducts = isAll
    ? products
    : products.filter((p) => p.subcategory === selectedSubcategory);

  return (
    <div className="flex md:hidden -mx-4 border-t border-slate-100 bg-white">
      {/* LEFT RAIL — vertical L2 tiles */}
      <aside className="w-[92px] flex-shrink-0 overflow-y-auto bg-slate-50/70 border-r border-slate-100 sticky top-14 self-start max-h-[calc(100vh-56px)] no-scrollbar">
        {category.subcategories.map((sub) => {
          const active =
            sub === selectedSubcategory || (sub === "All Items" && isAll);
          const img = imageBySubcategory.get(sub);
          const count = countBySubcategory.get(sub) ?? 0;
          return (
            <button
              key={sub}
              type="button"
              onClick={() => onSelectSubcategory(sub)}
              className={`relative flex w-full flex-col items-center gap-1.5 border-l-[3px] px-1.5 py-2.5 text-center cursor-pointer transition-all ${
                active
                  ? "border-emerald-600 bg-white"
                  : "border-transparent hover:bg-white/70"
              }`}
            >
              {sub === "All Items" ? (
                // The "All" tile is a compact emerald pill instead of a photo
                // so it reads as a filter reset, not another shelf.
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl border-2 ${
                    active
                      ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-white text-slate-500"
                  }`}
                >
                  <span className="text-[10px] font-black">ALL</span>
                </div>
              ) : img ? (
                <div className="relative h-12 w-12 overflow-hidden rounded-xl bg-slate-100">
                  <Image
                    src={img}
                    alt={sub}
                    fill
                    unoptimized
                    sizes="48px"
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-200 text-lg">
                  {category.icon}
                </div>
              )}
              <p
                className={`text-[10px] leading-tight ${
                  active
                    ? "font-black text-emerald-700"
                    : "font-semibold text-slate-700"
                }`}
              >
                {sub === "All Items" ? "All" : sub}
              </p>
              {count > 0 && sub !== "All Items" && (
                <span className="text-[9px] font-bold text-slate-400">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </aside>

      {/* RIGHT PANE — filter chips + product grid */}
      <div className="flex-1 min-w-0">
        {/* Filter/sort chip row — sticky just below the header so the chips
            stay accessible while the shopper scrolls the grid. */}
        <div className="sticky top-14 z-10 flex gap-2 overflow-x-auto bg-white/95 backdrop-blur px-3 py-2 no-scrollbar border-b border-slate-100">
          <ChipButton icon={SlidersHorizontal} label="Filters" />
          <ChipButton icon={ArrowDownUp} label="Sort" />
          <ChipButton icon={IndianRupee} label="Price" />
          <ChipButton icon={Tags} label="Brand" />
        </div>

        {/* Section heading */}
        <div className="px-3 pt-3 pb-1">
          <h3 className="text-sm font-black text-slate-900 leading-tight">
            {isAll ? category.name : selectedSubcategory}
          </h3>
          <p className="text-[11px] text-slate-500">
            {rightPaneProducts.length}{" "}
            {rightPaneProducts.length === 1 ? "item" : "items"}
          </p>
        </div>

        {rightPaneProducts.length === 0 ? (
          <div className="px-3 py-16 text-center text-xs text-slate-500">
            Nothing on this shelf right now. Try another category on the left.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 px-3 pb-6 pt-2">
            {rightPaneProducts.map((p) => (
              <div key={p.id} onClick={() => onSelectPdpProduct(p)}>
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Chip in the filter/sort row above the product grid. Purely visual for now —
 * wiring these to real filter state is a follow-up. Kept local to this
 * component because the styling matches the split view and nothing else uses
 * the exact same shape.
 */
function ChipButton({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setPressed((v) => !v)}
      className={`flex flex-shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-black transition-colors cursor-pointer ${
        pressed
          ? "border-emerald-600 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
      }`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}
