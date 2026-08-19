"use client";

import { use, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/store/useCartStore";
import { useProductStore } from "@/store/useProductStore";
import MobileBottomNav from "@/components/customer/MobileBottomNav";
import {
  ArrowLeft,
  Star,
  Clock,
  CheckCircle2,
  AlertCircle,
  Flame,
  Plus,
  Minus,
  ShieldCheck,
  ShoppingBag,
  Loader2,
  SearchX,
} from "lucide-react";

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { items, addItem, decreaseQuantity, getTotalItems } = useCartStore();
  const { products, loading, fetchProducts } = useProductStore();

  // Pull from the live catalog so prices, stock and availability match what
  // the rest of the app sees. Previously this page used a static `PRODUCTS`
  // dump from lib/dummyData AND, worse, silently fell back to `PRODUCTS[0]`
  // for unknown ids — landing users on a completely different product.
  useEffect(() => {
    if (products.length === 0) fetchProducts();
  }, [fetchProducts, products.length]);

  const product = products.find((p) => p.id === id) ?? null;
  const cartItem = product ? items.find((i) => i.product.id === product.id) : undefined;
  const quantity = cartItem ? cartItem.quantity : 0;
  const totalCartItems = getTotalItems();

  if (loading && !product) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
        Loading product…
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 px-4 py-16">
        <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm space-y-3">
          <SearchX className="mx-auto h-10 w-10 text-slate-400" />
          <h2 className="text-base font-black text-slate-900">Product not found</h2>
          <p className="text-xs text-slate-500">
            This item may have been removed from the catalog.
          </p>
          <Link
            href="/"
            className="inline-block rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-500"
          >
            Back to store
          </Link>
        </div>
        <MobileBottomNav />
      </div>
    );
  }

  const discount = product.originalPrice
    ? Math.round(
        ((product.originalPrice - product.price) / product.originalPrice) * 100
      )
    : 0;

  // A missing stock value from the catalog should be treated as "unknown",
  // not silently defaulted to 25 — that lied to customers whenever a product
  // hadn't been given an explicit stock number.
  const stockCount = product.stock ?? null;
  const isOutOfStock = stockCount !== null && stockCount <= 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-28">
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md px-4 py-3">
        <div className="mx-auto max-w-2xl flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-emerald-700"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Store
          </button>

          <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
            Product Detail
          </span>

          <Link href="/cart" className="relative flex items-center gap-1 text-slate-700">
            <ShoppingBag className="h-5 w-5" />
            {totalCartItems > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[9px] font-black text-white">
                {totalCartItems}
              </span>
            )}
          </Link>
        </div>
      </header>

      {/* Main PDP Container */}
      <main className="mx-auto max-w-2xl px-4 py-6 space-y-6">
        {/* Product Image Card */}
        <div className="relative aspect-square w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm flex items-center justify-center">
          {discount > 0 && (
            <span className="absolute left-4 top-4 z-10 rounded-full bg-emerald-600 px-3 py-1 text-xs font-black text-white shadow-md">
              {discount}% OFF
            </span>
          )}
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            unoptimized
            className="object-cover"
          />
        </div>

        {/* Product Header & Pricing */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
          <div>
            <span className="inline-block rounded-lg bg-emerald-50 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-700 uppercase">
              {product.category}
            </span>
            <h1 className="mt-1.5 text-xl font-black text-slate-900 leading-tight sm:text-2xl">
              {product.name}
            </h1>
            <p className="text-xs font-semibold text-slate-500 mt-1">
              Net Weight: {product.weight}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {product.rating && (
              <div className="flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                {product.rating} (420+ reviews)
              </div>
            )}
            <div className="flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
              <Clock className="h-4 w-4 text-emerald-600" />
              Express 10 Mins
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-baseline justify-between">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900">
                  ₹{product.price}
                </span>
                {product.originalPrice && (
                  <span className="text-sm text-slate-400 line-through">
                    ₹{product.originalPrice}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">Inclusive of all taxes</p>
            </div>

            {isOutOfStock ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3.5 py-1.5 text-xs font-bold text-rose-700">
                <AlertCircle className="h-4 w-4 text-rose-600" />
                Out of Stock
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3.5 py-1.5 text-xs font-bold text-emerald-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                {stockCount !== null ? `In Stock (${stockCount} available)` : "In Stock"}
              </span>
            )}
          </div>
        </div>

        {/* Overview & Nutrition Facts */}
        {product.description && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 space-y-2 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Product Information
            </h3>
            <p className="text-xs leading-relaxed text-slate-700">
              {product.description}
            </p>
          </div>
        )}

        {(() => {
          // Live catalog products don't guarantee a nutritionalInfo field;
          // narrow with an any-cast so this optional section can still render
          // when the underlying record happens to carry it.
          const nutri = (product as any).nutritionalInfo as
            | { calories?: string; protein?: string; carbs?: string; fat?: string }
            | undefined;
          if (!nutri) return null;
          return (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 space-y-3 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Flame className="h-4 w-4 text-amber-500" />
                Nutritional Overview (per 100g)
              </h3>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="rounded-2xl bg-slate-50 p-3 border border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Energy</p>
                  <p className="text-xs font-extrabold text-slate-900 mt-0.5">
                    {nutri.calories}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3 border border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Protein</p>
                  <p className="text-xs font-extrabold text-slate-900 mt-0.5">
                    {nutri.protein}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3 border border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Carbs</p>
                  <p className="text-xs font-extrabold text-slate-900 mt-0.5">
                    {nutri.carbs}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3 border border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Fat</p>
                  <p className="text-xs font-extrabold text-slate-900 mt-0.5">
                    {nutri.fat}
                  </p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Satyug Quality Guarantee */}
        <div className="flex items-center gap-3 rounded-3xl bg-emerald-50 p-4 border border-emerald-200/80 text-xs text-emerald-900">
          <ShieldCheck className="h-6 w-6 text-emerald-600 flex-shrink-0" />
          <div>
            <p className="font-extrabold">Satyug Fresh Quality Guarantee</p>
            <p className="text-[11px] text-emerald-700 mt-0.5">
              Instant replacement or refund if you are not satisfied.
            </p>
          </div>
        </div>
      </main>

      {/* Fixed Sticky Action Bar at Bottom optimized for mobile phone */}
      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 p-4 backdrop-blur-md">
        <div className="mx-auto max-w-2xl flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400">Total Price</p>
            <p className="text-xl font-black text-slate-900">₹{product.price}</p>
          </div>

          <div>
            {isOutOfStock ? (
              <button
                disabled
                className="rounded-2xl bg-slate-200 px-6 py-3 text-xs font-bold text-slate-500 cursor-not-allowed"
              >
                Out of Stock
              </button>
            ) : quantity === 0 ? (
              <button
                onClick={() => addItem(product)}
                className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3.5 text-xs font-extrabold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 active:scale-95 transition-all"
              >
                <Plus className="h-4 w-4" /> Add to Basket
              </button>
            ) : (
              <div className="flex items-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/30">
                <button
                  onClick={() => decreaseQuantity(product.id)}
                  className="px-4 py-3 text-xs font-bold hover:bg-emerald-700 rounded-l-2xl"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-8 text-center text-sm font-black">
                  {quantity}
                </span>
                <button
                  onClick={() => addItem(product)}
                  className="px-4 py-3 text-xs font-bold hover:bg-emerald-700 rounded-r-2xl"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <MobileBottomNav />
    </div>
  );
}
