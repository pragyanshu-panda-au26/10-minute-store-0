"use client";

import { useEffect, useRef } from "react";
import { CATEGORIES } from "@/lib/dummyData";

interface CategoryHierarchyProps {
  selectedCategory: string;
  selectedSubcategory: string;
  onSelectSubcategory: (sub: string) => void;
}

export default function CategoryHierarchy({
  selectedCategory,
  selectedSubcategory,
  onSelectSubcategory,
}: CategoryHierarchyProps) {
  const activePillRef = useRef<HTMLButtonElement | null>(null);

  const categoryObj = CATEGORIES.find((c) => c.id === selectedCategory);

  // UX-08 — when the active subcategory changes (deep link, category
  // switch, or programmatic navigation), pull it into view horizontally.
  // Without this, a subcategory beyond the first few is highlighted but
  // off-screen inside the scroll strip.
  useEffect(() => {
    if (!activePillRef.current) return;
    activePillRef.current.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [selectedCategory, selectedSubcategory]);

  if (!categoryObj || !categoryObj.subcategories || categoryObj.subcategories.length <= 1) {
    return null;
  }

  return (
    <div className="relative mb-4">
      <div className="overflow-x-auto py-2 no-scrollbar scroll-smooth">
        <div className="flex gap-2">
          {categoryObj.subcategories.map((sub) => {
            const isActive = selectedSubcategory === sub;
            return (
              <button
                key={sub}
                ref={isActive ? activePillRef : undefined}
                onClick={() => onSelectSubcategory(sub)}
                className={`rounded-full px-4 py-2 text-xs font-bold transition-all flex-shrink-0 active:scale-95 touch-manipulation cursor-pointer ${
                  isActive
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                {sub}
              </button>
            );
          })}
        </div>
      </div>
      {/* Soft fade on the right edge to hint "more scrollable content" —
          the strip was silently truncating without any affordance before. */}
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-slate-50 dark:from-slate-950 to-transparent" />
    </div>
  );
}
