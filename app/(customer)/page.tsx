"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CustomerHeader from "@/components/customer/CustomerHeader";
import ProductCard from "@/components/customer/ProductCard";
import CartDrawer from "@/components/customer/CartDrawer";
import BannerCarousel from "@/components/customer/BannerCarousel";
import CategoryHierarchy from "@/components/customer/CategoryHierarchy";
import MobileCategoryGrid from "@/components/customer/MobileCategoryGrid";
import ProductDetailModal from "@/components/customer/ProductDetailModal";
import ServiceabilityModal from "@/components/customer/ServiceabilityModal";
import GatedServiceabilityModal from "@/components/customer/GatedServiceabilityModal";
import MobileBottomNav from "@/components/customer/MobileBottomNav";
import InstallAppButton from "@/components/customer/InstallAppButton";
import SmartSearchBar from "@/components/customer/SmartSearchBar";
import SortFilterBar, {
  applySortFilters,
  DEFAULT_FILTERS,
  DEFAULT_SORT,
  Filters,
  SortKey,
} from "@/components/customer/SortFilterBar";
import { CATEGORIES, ExtendedProduct } from "@/lib/dummyData";
import { useProductStore } from "@/store/useProductStore";
import { useUserStore } from "@/store/useUserStore";
import { useThemeStore } from "@/store/useThemeStore";
import { Loader2, SearchX, MapPin, History, HelpCircle, Lock, ShieldCheck } from "lucide-react";

export default function CustomerPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("All Items");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>(DEFAULT_SORT);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  // Modals state
  const [selectedPdpProduct, setSelectedPdpProduct] = useState<ExtendedProduct | null>(null);
  const [isServiceabilityOpen, setIsServiceabilityOpen] = useState(false);
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);

  // Live product catalog — fetched after location verification
  const { products, loading, error, fetchProducts } = useProductStore();
  const { getActiveAddress, hydrateSession } = useUserStore();
  const { initTheme } = useThemeStore();
  const activeAddr = getActiveAddress();

  useEffect(() => {
    hydrateSession();
    initTheme();
  }, [hydrateSession, initTheme]);

  const handleServiceableConfirmed = (storeId: string) => {
    setActiveStoreId(storeId);
    fetchProducts();
  };

  const handleSelectCategoryAndSubcategory = (catId: string, subName: string) => {
    setSelectedCategory(catId);
    setSelectedSubcategory(subName);
  };

  // Filter products by category, subcategory & search query
  const searchAndCategoryFiltered = (products as ExtendedProduct[]).filter((product) => {
    const matchesCategory =
      selectedCategory === "all" || product.category === selectedCategory;
    const matchesSubcategory =
      selectedSubcategory === "All Items" ||
      product.subcategory === selectedSubcategory;
    const matchesSearch =
      searchQuery.trim() === "" ||
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ((product as any).brand || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.tags &&
        product.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())));

    return matchesCategory && matchesSubcategory && matchesSearch;
  });

  // Sort + user filters on top
  const filteredProducts = applySortFilters(searchAndCategoryFiltered, sortKey, filters);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-28 transition-colors">
      {/* Gated Location Permission Modal — Blocks Catalog Until Location Verified */}
      <GatedServiceabilityModal
        onServiceableConfirmed={handleServiceableConfirmed}
      />

      {/* Express Yellow Blinkit Mobile Header */}
      <CustomerHeader
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />



      {/* Dynamic Promotional Hero Banner Carousel */}
      <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
        <BannerCarousel />
      </div>

      {/* MOBILE BLINKIT-STYLE VISUAL CATEGORY GRID (VISIBLE ON PHONE UX) */}
      <div className="md:hidden mt-3">
        <MobileCategoryGrid
          selectedCategory={selectedCategory}
          selectedSubcategory={selectedSubcategory}
          onSelectCategoryAndSubcategory={handleSelectCategoryAndSubcategory}
        />
      </div>

      {/* Main Content Layout */}
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex gap-8">
          {/* Desktop 25% Left Sidebar for Categories */}
          <aside className="hidden w-1/4 flex-shrink-0 md:block">
            <div className="sticky top-24 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
              <h2 className="mb-3 text-xs font-bold tracking-wider text-slate-400 uppercase">
                Categories
              </h2>
              <nav className="space-y-1">
                {CATEGORIES.map((cat) => {
                  const isSelected = selectedCategory === cat.id;
                  const catProductsCount =
                    cat.id === "all"
                      ? products.length
                      : products.filter((p) => p.category === cat.id).length;

                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setSelectedCategory(cat.id);
                        setSelectedSubcategory("All Items");
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all ${
                        isSelected
                          ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800"
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-base">{cat.icon}</span>
                        <span>{cat.name}</span>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] ${
                          isSelected
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {catProductsCount}
                      </span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Product Grid & Subcategories */}
          <main className="flex-1">
            {/* Hierarchical Subcategory Pills Filter */}
            <CategoryHierarchy
              selectedCategory={selectedCategory}
              selectedSubcategory={selectedSubcategory}
              onSelectSubcategory={setSelectedSubcategory}
            />

            {/* Search bar */}
            <div className="mb-3">
              <SmartSearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                products={products as ExtendedProduct[]}
              />
            </div>

            {/* Section heading + sort/filter row */}
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white truncate">
                  {CATEGORIES.find((c) => c.id === selectedCategory)?.name || "Products"}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {filteredProducts.length}{" "}
                  {filteredProducts.length === 1 ? "item" : "items"}
                </p>
              </div>
            </div>

            <div className="mb-4">
              <SortFilterBar
                products={searchAndCategoryFiltered}
                sort={sortKey}
                onSortChange={setSortKey}
                filters={filters}
                onFiltersChange={setFilters}
              />
            </div>

            {loading && products.length === 0 && (
              <div className="flex items-center justify-center py-16 text-slate-400 text-xs gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-600" /> Loading fresh items…
              </div>
            )}

            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800 my-4">
                {error}. Try refreshing.
              </div>
            )}

            {/* Product Cards Grid */}
            {filteredProducts.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 sm:gap-4">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => setSelectedPdpProduct(product)}
                    className="cursor-pointer"
                  >
                    <ProductCard product={product} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center">
                <SearchX className="mb-3 h-10 w-10 text-slate-400" />
                <h3 className="text-base font-bold text-slate-800 dark:text-white">
                  No products found
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Try searching for something else or switch categories.
                </p>
                <button
                  onClick={() => {
                    setSelectedCategory("all");
                    setSelectedSubcategory("All Items");
                    setSearchQuery("");
                  }}
                  className="mt-4 rounded-xl bg-slate-900 text-white dark:bg-emerald-500 dark:text-slate-950 px-4 py-2 text-xs font-bold hover:bg-slate-800"
                >
                  Reset Filters
                </button>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Floating Checkout Strip & Cart Drawer */}
      <CartDrawer />

      {/* PDP Modal Quick Preview */}
      <ProductDetailModal
        product={selectedPdpProduct}
        onClose={() => setSelectedPdpProduct(null)}
      />

      {/* Serviceability Check Modal */}
      <ServiceabilityModal
        isOpen={isServiceabilityOpen}
        onClose={() => setIsServiceabilityOpen(false)}
        currentAddressStr={`${activeAddr.houseNo}, ${activeAddr.area}, ${activeAddr.city}`}
      />

      {/* Mobile Bottom Navigation Bar */}
      <InstallAppButton />
      <MobileBottomNav />
    </div>
  );
}
