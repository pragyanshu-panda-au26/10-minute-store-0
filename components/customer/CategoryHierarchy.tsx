"use client";

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
  const categoryObj = CATEGORIES.find((c) => c.id === selectedCategory);
  if (!categoryObj || !categoryObj.subcategories || categoryObj.subcategories.length <= 1) {
    return null;
  }

  return (
    <div className="mb-4 overflow-x-auto py-2 no-scrollbar scroll-smooth">
      <div className="flex gap-2">
        {categoryObj.subcategories.map((sub) => {
          const isActive = selectedSubcategory === sub;
          return (
            <button
              key={sub}
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
  );
}
