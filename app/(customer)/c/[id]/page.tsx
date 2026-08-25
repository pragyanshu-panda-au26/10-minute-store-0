"use client";

/**
 * Category detail route — `/c/[id]?sub=<subName>`.
 *
 * Mirrors Blinkit's L2 detail page: two-pane split view with a vertical
 * subcategory rail on the left and a 2-column product grid on the right.
 * Home mega-grid taps route here instead of the previous in-page filter,
 * so back-button + share-link both work naturally.
 *
 * The rest of the chrome (header, cart drawer, PDP modal, bottom nav) is the
 * same as the home page — this route is deliberately a thin shell so the
 * customer perceives it as "same app, deeper screen".
 */

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import CustomerHeader from "@/components/customer/CustomerHeader";
import ProductDetailModal from "@/components/customer/ProductDetailModal";
import CartDrawer from "@/components/customer/CartDrawer";
import MobileBottomNav from "@/components/customer/MobileBottomNav";
import ProductCard from "@/components/customer/ProductCard";
import CategoryHierarchy from "@/components/customer/CategoryHierarchy";
import MobileCategorySplitView from "@/components/customer/MobileCategorySplitView";
import { CATEGORIES, ExtendedProduct } from "@/lib/dummyData";
import { useProductStore } from "@/store/useProductStore";
import { useUserStore } from "@/store/useUserStore";
import { ArrowLeft, Loader2 } from "lucide-react";

interface Params {
  id: string;
}

export default function CategoryDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id: categoryId } = use(params);
  const search = useSearchParams();
  const initialSub = search.get("sub") || "All Items";

  const [selectedSubcategory, setSelectedSubcategory] = useState(initialSub);
  const [selectedPdpProduct, setSelectedPdpProduct] =
    useState<ExtendedProduct | null>(null);

  const { products, loading, error, fetchProducts } = useProductStore();
  const { hydrateSession } = useUserStore();

  useEffect(() => {
    hydrateSession();
    // Always kick off a fresh fetch on mount. Idempotent, and this route
    // is often the deep-link entry point (a shared URL, a back-navigation
    // after a full reload) where the store is empty. If home already
    // populated the store this is a wasted request but not a broken one.
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If the URL's `?sub=` changes at runtime (Blinkit-style shareable deep
  // link), reflect it in local state. Only kicks when the param is different
  // so it doesn't fight the user's own taps.
  useEffect(() => {
    const q = search.get("sub");
    if (q && q !== selectedSubcategory) setSelectedSubcategory(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.toString()]);

  const category = useMemo(
    () => CATEGORIES.find((c) => c.id === categoryId),
    [categoryId]
  );

  // Filter products to this L1. Also strip inactive/oos-if-hidden entries
  // — the API already returns only active ones so this is a belt-and-braces
  // guard for cached state.
  const inCategory = useMemo(
    () =>
      (products as ExtendedProduct[]).filter((p) => p.category === categoryId),
    [products, categoryId]
  );

  // Desktop-only pane feed: mirrors the home page's SortFilterBar-driven grid
  // for parity; on mobile we hand off to the split view instead.
  const desktopGrid = useMemo(() => {
    if (!selectedSubcategory || selectedSubcategory === "All Items")
      return inCategory;
    return inCategory.filter((p) => p.subcategory === selectedSubcategory);
  }, [inCategory, selectedSubcategory]);

  if (!category) {
    return (
      <div className="min-h-screen bg-slate-50 pb-24">
        <CustomerHeader />
        <div className="px-4 pt-6 text-center">
          <p className="text-sm font-bold text-slate-900">
            We couldn't find that category.
          </p>
          <Link
            href="/"
            className="mt-3 inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-500"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to store
          </Link>
        </div>
        <MobileBottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <CustomerHeader />

      {/* Compact page header — back arrow, category name, item count.
          Sticks below CustomerHeader on mobile so the split view starts
          right underneath. */}
      <div className="px-4 pt-3 md:pt-4">
        <div className="flex items-center gap-2 mb-2">
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:text-slate-900"
            aria-label="Back to home"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-base font-black text-slate-900 leading-tight truncate">
              {category.name}
            </h1>
            <p className="text-[11px] text-slate-500">
              {loading
                ? "Loading…"
                : `${inCategory.length} items across ${category.subcategories.length - 1} shelves`}
            </p>
          </div>
        </div>
      </div>

      {/* MOBILE — split view (vertical L2 rail + right grid) */}
      {loading && products.length === 0 ? (
        <div className="md:hidden flex items-center justify-center py-24">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
        </div>
      ) : (
        <MobileCategorySplitView
          category={category}
          selectedSubcategory={selectedSubcategory}
          onSelectSubcategory={setSelectedSubcategory}
          products={inCategory}
          onSelectPdpProduct={setSelectedPdpProduct}
        />
      )}

      {/* DESKTOP — legacy layout: sidebar categories on the left, grid right.
          Blinkit's desktop is the same shape, so we don't reinvent — we
          reuse the existing CategoryHierarchy sidebar for consistency with
          the home page. */}
      <div className="hidden md:grid px-4 md:grid-cols-[220px,1fr] gap-6">
        <aside>
          <CategoryHierarchy
            selectedCategory={categoryId}
            selectedSubcategory={selectedSubcategory}
            onSelectSubcategory={setSelectedSubcategory}
          />
        </aside>
        <div>
          <h2 className="text-base font-black text-slate-900 mb-3">
            {selectedSubcategory === "All Items"
              ? category.name
              : selectedSubcategory}
            <span className="ml-2 text-xs font-semibold text-slate-500">
              {desktopGrid.length} items
            </span>
          </h2>
          {desktopGrid.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-500">
              Nothing on this shelf right now.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {desktopGrid.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  onSelect={() => setSelectedPdpProduct(p)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedPdpProduct && (
        <ProductDetailModal
          product={selectedPdpProduct}
          onClose={() => setSelectedPdpProduct(null)}
        />
      )}

      <CartDrawer />
      <MobileBottomNav />
    </div>
  );
}
