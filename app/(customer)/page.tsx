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
import GatedServiceabilityModal from "@/components/customer/GatedServiceabilityModal";
import ReorderBasketRail from "@/components/customer/ReorderBasketRail";
import MobileBottomNav from "@/components/customer/MobileBottomNav";
import InstallAppButton from "@/components/customer/InstallAppButton";
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

  // Live product catalog — fetched after location verification
  const { products, loading, error, fetchProducts } = useProductStore();
  const { getActiveAddress, hydrateSession } = useUserStore();
  const { initTheme } = useThemeStore();
  const activeAddr = getActiveAddress();

  useEffect(() => {
    hydrateSession();
    initTheme();
    // Blinkit-parity — the catalog renders immediately on first paint, before
    // the location strip is resolved. The products API returns the same
    // catalog regardless of store, so fetching on mount is safe. When a real
    // location is later confirmed we re-fetch through the callback below;
    // that's idempotent (same URL, same response) and lets store-scoped
    // catalogs slot in cleanly later without changing this call site.
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleServiceableConfirmed = (_storeId: string) => {
    // Store-scoped catalogs aren't wired up yet — for now every serviceable
    // location gets the same live catalog. When per-store products land,
    // thread `_storeId` through to fetchProducts().
    fetchProducts();
  };

  const handleSelectCategoryAndSubcategory = (catId: string, subName: string) => {
    setSelectedCategory(catId);
    setSelectedSubcategory(subName);
    // Scroll the freshly-filtered grid into view so a category tap doesn't
    // silently mutate a section the customer is scrolled miles above. Matches
    // Blinkit — tap a category, the listing snaps into place.
    if (typeof window !== "undefined") {
      // Defer to the next frame so the state → re-render happens before the
      // scroll, otherwise we scroll to the stale grid layout.
      requestAnimationFrame(() => {
        document.getElementById("all-products")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  };

  // Derived rails — sourced from the same product list so no extra API calls.
  // `Hot deals` orders by absolute discount %, `Your daily fresh needs` picks
  // the Vegetables & Fruits subcategory (the highest-frequency repeat basket
  // in Blinkit's own data). Both caps at 12 so a rail is scrollable without
  // being a full second grid.
  const RAIL_SIZE = 12;
  const hotDealsRail = (products as ExtendedProduct[])
    .filter((p) => p.originalPrice && p.originalPrice > p.price)
    .map((p) => ({
      p,
      pct: Math.round(((p.originalPrice! - p.price) / p.originalPrice!) * 100),
    }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, RAIL_SIZE)
    .map((x) => x.p);
  const freshRail = (products as ExtendedProduct[])
    .filter((p) => p.subcategory === "Vegetables & Fruits")
    .slice(0, RAIL_SIZE);

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



      {/* Reorder-your-basket rail — auto-hides for guests, first-time
          customers, and anyone with items already in their cart. Highest-
          conversion single element on the entire home page for repeat users. */}
      <ReorderBasketRail />

      {/* Dynamic Promotional Hero Banner Carousel */}
      <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
        <BannerCarousel />
      </div>

      {/* MOBILE BLINKIT-STYLE VISUAL CATEGORY GRID (VISIBLE ON PHONE UX).
          `#categories` anchor makes the bottom-nav Categories tab
          scroll straight here when tapped from the home page. */}
      <div id="categories" className="md:hidden mt-3 scroll-mt-20">
        <MobileCategoryGrid
          selectedCategory={selectedCategory}
          selectedSubcategory={selectedSubcategory}
          onSelectCategoryAndSubcategory={handleSelectCategoryAndSubcategory}
        />
      </div>

      {/* Blinkit-style deal rails — sit between the category grid and the
          filterable main grid. They give first-time visitors an immediate
          reason to tap something before they commit to browsing a category.
          Only render when we actually have products for the rail — an empty
          rail with a "see all" chip and no cards is worse than no rail. */}
      {hotDealsRail.length >= 3 && (
        <ProductRail
          title="🔥 Hot deals"
          subtitle="Biggest discounts, delivered in minutes."
          products={hotDealsRail}
          onSelect={setSelectedPdpProduct}
        />
      )}
      {freshRail.length >= 3 && (
        <ProductRail
          title="🥬 Your daily fresh needs"
          subtitle="Vegetables & fruits, restocked every morning."
          products={freshRail}
          onSelect={setSelectedPdpProduct}
        />
      )}

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
            {/* Hierarchical subcategory pills — desktop only (UX-05).
                On mobile the MobileCategoryGrid above IS the taxonomy — the
                same subcategories were being rendered twice (image tiles
                then pills) which offered the same choice in two dialects. */}
            <div className="hidden md:block">
              <CategoryHierarchy
                selectedCategory={selectedCategory}
                selectedSubcategory={selectedSubcategory}
                onSelectSubcategory={setSelectedSubcategory}
              />
            </div>

            {/* The in-content search bar used to live here — removed as part
                of the UX audit (UX-04). CustomerHeader already contains the
                same input in its second row, always above the fold on mobile.
                Two inputs bound to the same state was noise. If desktop-only
                SmartSearch (autosuggest) is wanted back, wire it into the
                header md: block instead of below the fold. */}

            {/* Section heading + sort/filter row */}
            <div
              id="all-products"
              className="mb-3 flex items-center justify-between gap-3 scroll-mt-24"
            >
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

            {/* UX-09 — sort / filter is UI weight before a value when the
                category is small. For 8 items or fewer the customer can
                scan the whole grid faster than they can pick a filter, and
                the chip row takes more screen than the products on mobile. */}
            {searchAndCategoryFiltered.length >= 8 && (
              <div className="mb-4">
                <SortFilterBar
                  products={searchAndCategoryFiltered}
                  sort={sortKey}
                  onSortChange={setSortKey}
                  filters={filters}
                  onFiltersChange={setFilters}
                />
              </div>
            )}

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

      {/* The manual ServiceabilityModal / GatedServiceabilityModal were dead
          — the state that would open them was never set. Removed. Location
          gating lives in the header + address flow now. */}

      {/* Mobile Bottom Navigation Bar */}
      <InstallAppButton />
      <MobileBottomNav />
    </div>
  );
}

/**
 * Horizontally-scrolling product rail — Blinkit's "Hot deals" / "Your daily
 * fresh needs" pattern. Kept local to this file because it's not reused
 * anywhere else and the design is intentionally lightweight (title + subtitle
 * + horizontal scroll of ProductCards). Tap opens the PDP modal, same as
 * the main grid.
 */
function ProductRail({
  title,
  subtitle,
  products,
  onSelect,
}: {
  title: string;
  subtitle: string;
  products: ExtendedProduct[];
  onSelect: (p: ExtendedProduct) => void;
}) {
  return (
    <section className="mt-4 px-4">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-slate-900 dark:text-white">
            {title}
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
        </div>
      </div>
      {/* -mx-4 + px-4 lets the last card breathe against the viewport edge
          without adding a scroll gutter to the section container above. */}
      <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1 snap-x">
        {products.map((p) => (
          <div
            key={p.id}
            onClick={() => onSelect(p)}
            className="w-36 flex-shrink-0 cursor-pointer snap-start"
          >
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}
