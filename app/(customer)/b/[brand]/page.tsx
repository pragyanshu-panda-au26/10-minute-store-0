"use client";

/**
 * Brand listing route — `/b/[brand]`. Renders every active product whose
 * `Product.brand` equals the URL segment (case-insensitive on the server).
 *
 * Deliberately lightweight: same header/nav/bottom-bar chrome as the home
 * page but no category grid, deal rails, or SEO fluff. The point is "here
 * is everything Amul makes", not a landing page.
 */

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import CustomerHeader from "@/components/customer/CustomerHeader";
import ProductCard from "@/components/customer/ProductCard";
import ProductDetailModal from "@/components/customer/ProductDetailModal";
import MobileBottomNav from "@/components/customer/MobileBottomNav";
import CartDrawer from "@/components/customer/CartDrawer";
import { ExtendedProduct } from "@/lib/dummyData";
import { ArrowLeft, Sparkles } from "lucide-react";

interface Params {
  brand: string;
}

export default function BrandPage({ params }: { params: Promise<Params> }) {
  // Next.js 16 hands params as a Promise — `use()` unwraps it inside a
  // client component without turning the whole route into an async fn.
  const { brand: brandParam } = use(params);
  const brand = decodeURIComponent(brandParam);

  const [products, setProducts] = useState<ExtendedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPdpProduct, setSelectedPdpProduct] =
    useState<ExtendedProduct | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/products?brand=${encodeURIComponent(brand)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setProducts((d?.products ?? []) as ExtendedProduct[]);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(String(e?.message ?? e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [brand]);

  // Grouped-by-category counts feed the little header stat pill so a shopper
  // instantly sees the spread ("15 items across 3 aisles"). Derived only —
  // no need to memoize aggressively but it makes intent clearer.
  const aisles = useMemo(() => {
    const s = new Set<string>();
    for (const p of products) s.add(p.category);
    return s.size;
  }, [products]);

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <CustomerHeader />

      <div className="px-4 pt-3">
        <div className="flex items-center gap-2 mb-3">
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:text-slate-900"
            aria-label="Back to home"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600">
              Brand
            </p>
            <h1 className="text-lg font-black text-slate-900 truncate">
              {brand}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4 text-xs text-slate-500">
          <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
          <span>
            {loading
              ? "Loading…"
              : `${products.length} item${products.length === 1 ? "" : "s"}`}
            {aisles > 0 && !loading && (
              <>
                {" · "}
                {aisles} aisle{aisles === 1 ? "" : "s"}
              </>
            )}
          </span>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700">
            Could not load {brand}: {error}
          </div>
        )}

        {!loading && products.length === 0 && !error && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
            <p className="text-sm font-bold text-slate-900">
              Nothing from {brand} right now.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              We're restocking. Head back to the main store for what's live.
            </p>
            <Link
              href="/"
              className="mt-3 inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-500"
            >
              Back to store
            </Link>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onSelect={() => setSelectedPdpProduct(p)}
            />
          ))}
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
