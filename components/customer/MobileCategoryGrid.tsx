"use client";

import Image from "next/image";
import { CATEGORIES } from "@/lib/dummyData";

interface MobileCategoryGridProps {
  selectedCategory: string;
  selectedSubcategory: string;
  onSelectCategoryAndSubcategory: (catId: string, subName: string) => void;
}

// Visual thumbnail images for each subcategory
const SUBCATEGORY_IMAGES: Record<string, string> = {
  // Grocery & Kitchen
  "Vegetables & Fruits": "https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=400&auto=format&fit=crop&q=80",
  "Atta, Rice & Dal": "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&auto=format&fit=crop&q=80",
  "Oil, Ghee & Masala": "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&auto=format&fit=crop&q=80",
  "Dairy, Bread & Eggs": "https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400&auto=format&fit=crop&q=80",
  "Dry Fruits & Cereals": "https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=400&auto=format&fit=crop&q=80",
  "Chicken, Meat & Fish": "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400&auto=format&fit=crop&q=80",
  "Kitchenware & Appliances": "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=400&auto=format&fit=crop&q=80",

  // Snacks & Drinks
  "Bakery & Biscuits": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&auto=format&fit=crop&q=80",
  "Chips & Namkeen": "https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=400&auto=format&fit=crop&q=80",
  "Sweets & Chocolates": "https://images.unsplash.com/photo-1582293041079-7814c2f12063?w=400&auto=format&fit=crop&q=80",
  "Drinks & Juices": "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&auto=format&fit=crop&q=80",
  "Tea, Coffee & Milk Drinks": "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&auto=format&fit=crop&q=80",
  "Instant Food": "https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=400&auto=format&fit=crop&q=80",
  "Sauces & Spreads": "https://images.unsplash.com/photo-1472476443507-c7a5948772fc?w=400&auto=format&fit=crop&q=80",
  "Ice Creams & More": "https://images.unsplash.com/photo-1560008511-11c63416e52d?w=400&auto=format&fit=crop&q=80",
  "Paan Corner": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&auto=format&fit=crop&q=80",

  // Beauty & Personal Care
  "Bath & Body": "https://images.unsplash.com/photo-1526947425960-945c6e72858f?w=400&auto=format&fit=crop&q=80",
  "Hair Care": "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=400&auto=format&fit=crop&q=80",
  "Skin & Face Care": "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400&auto=format&fit=crop&q=80",
  "Beauty & Cosmetics": "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=400&auto=format&fit=crop&q=80",
  "Feminine Hygiene": "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&auto=format&fit=crop&q=80",
  "Baby Care": "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=400&auto=format&fit=crop&q=80",
  "Health & Pharma": "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&auto=format&fit=crop&q=80",
  "Sexual Wellness": "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=400&auto=format&fit=crop&q=80",

  // Home & Electronics
  "Home & Lifestyle": "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=400&auto=format&fit=crop&q=80",
  "Cleaners & Repellents": "https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?w=400&auto=format&fit=crop&q=80",
  "Electronics & Appliances": "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=400&auto=format&fit=crop&q=80",
  "Stationery & Games": "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=400&auto=format&fit=crop&q=80",
  "Pet Care": "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=400&auto=format&fit=crop&q=80",

  // LIT Specialty
  "Tobacco & Smoking Essentials": "https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=400&auto=format&fit=crop&q=80",
  "Hookah & Accessories": "https://images.unsplash.com/photo-1516714435131-44d6b64dc6a2?w=400&auto=format&fit=crop&q=80",
  "Adult & Novelty Products": "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=400&auto=format&fit=crop&q=80",
  "Specialty Cosmetics": "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&auto=format&fit=crop&q=80",
};

export default function MobileCategoryGrid({
  selectedCategory,
  selectedSubcategory,
  onSelectCategoryAndSubcategory,
}: MobileCategoryGridProps) {
  const mainCategories = CATEGORIES.filter((c) => c.id !== "all");

  return (
    <div className="space-y-5 px-4 py-3 bg-white">
      {mainCategories.map((cat) => {
        const subList = cat.subcategories.filter((s) => s !== "All Items");

        return (
          <div key={cat.id} className="space-y-2.5">
            {/* Category Header Title */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>{cat.icon}</span>
                <span>{cat.name}</span>
              </h3>
            </div>

            {/* Horizontal Scrollable Visual Grid Cards (Blinkit UX) */}
            <div className="flex gap-2.5 overflow-x-auto no-scrollbar scroll-smooth pb-1 -mx-4 px-4">
              {subList.map((subName) => {
                const isSelected =
                  selectedCategory === cat.id && selectedSubcategory === subName;
                const imgUrl =
                  SUBCATEGORY_IMAGES[subName] ||
                  "https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&auto=format&fit=crop&q=80";

                return (
                  <button
                    key={subName}
                    onClick={() => onSelectCategoryAndSubcategory(cat.id, subName)}
                    className={`flex flex-col items-center flex-shrink-0 w-20 text-center group cursor-pointer transition-transform active:scale-95 touch-manipulation`}
                  >
                    {/* Light Mint/Teal Container Box */}
                    <div
                      className={`relative flex h-20 w-20 items-center justify-center rounded-2xl p-2 transition-all shadow-2xs ${
                        isSelected
                          ? "bg-emerald-100 ring-2 ring-emerald-600 shadow-md"
                          : "bg-[#EBF7F6] border border-teal-100/80 group-hover:bg-teal-100/80"
                      }`}
                    >
                      <Image
                        src={imgUrl}
                        alt={subName}
                        width={64}
                        height={64}
                        unoptimized
                        className="object-contain h-14 w-14 rounded-xl group-hover:scale-105 transition-transform"
                      />
                    </div>

                    {/* Subcategory Label Below Card */}
                    <span
                      className={`mt-1.5 text-[10px] font-bold leading-tight line-clamp-2 ${
                        isSelected ? "text-emerald-700 font-extrabold" : "text-slate-800"
                      }`}
                    >
                      {subName}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
