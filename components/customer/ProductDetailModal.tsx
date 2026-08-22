"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Product, ProductVariantLite, useCartStore } from "@/store/useCartStore";
import { CATEGORIES, ExtendedProduct } from "@/lib/dummyData";
import {
  X,
  Plus,
  Minus,
  Star,
  Clock,
  CheckCircle2,
  AlertCircle,
  Flame,
  ShieldCheck,
} from "lucide-react";

interface ProductDetailModalProps {
  product: ExtendedProduct | null;
  onClose: () => void;
}

export default function ProductDetailModal({
  product,
  onClose,
}: ProductDetailModalProps) {
  const { items, addItem, decreaseQuantity } = useCartStore();
  const [imageError, setImageError] = useState(false);

  // ─── Variant selection ─────────────────────────────────────
  // If the product has explicit variants, show a picker. Otherwise the base
  // product acts as the sole "variant" (backward-compat).
  const variants: ProductVariantLite[] = (product as any)?.variants ?? [];
  const hasVariants = variants.length > 0;
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    hasVariants
      ? (variants.find((v) => v.isDefault) ?? variants[0]).id
      : null
  );
  const selectedVariant = hasVariants
    ? variants.find((v) => v.id === selectedVariantId) ?? variants[0]
    : null;

  if (!product) return null;

  // Effective display values — variant wins if selected.
  const effectivePrice = selectedVariant?.price ?? product.price;
  const effectiveOriginal = selectedVariant?.originalPrice ?? product.originalPrice;
  const effectiveWeight = selectedVariant?.label ?? product.weight;
  const effectiveStock = selectedVariant?.stock ?? product.stock ?? 25;

  const cartItem = items.find(
    (i) => i.product.id === product.id && (i.variantId ?? null) === (selectedVariantId ?? null)
  );
  const quantity = cartItem ? cartItem.quantity : 0;

  const discount = effectiveOriginal
    ? Math.round(((effectiveOriginal - effectivePrice) / effectiveOriginal) * 100)
    : 0;

  const isOutOfStock = effectiveStock <= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/75 backdrop-blur-md animate-in fade-in"
        onClick={onClose}
      />

      {/* PDP Modal Panel — flex column so the header + footer stay pinned
          inside the panel and only the body scrolls. Guarantees the
          Add-to-Basket CTA is always visible without scrolling the modal off
          the viewport on small phones. */}
      <div className="relative z-10 flex w-full max-w-xl flex-col max-h-[92vh] overflow-hidden rounded-3xl bg-white text-slate-900 shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header Bar */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3.5">
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
            Product Details
          </span>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Top Section: High-Res Image Carousel & Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
            {/* Image Carousel — Blinkit-parity. Falls back to a single image
                when `product.images` is empty or absent. Dots pager tap =
                jump to slide; body swipe uses native scroll-snap so we don't
                take a runtime dep on a carousel library. */}
            <ImageCarousel
              images={
                (product.images && product.images.length > 0
                  ? product.images
                  : [product.imageUrl]
                ).filter(Boolean)
              }
              alt={product.name}
              discount={discount}
              onFail={() => setImageError(true)}
              hadError={imageError}
            />

            {/* Core Info */}
            <div className="space-y-3">
              <div>
                <span className="inline-block rounded-lg bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                  {/* Resolve the category slug (e.g. "grocery_kitchen") to its
                      human name from CATEGORIES. Falls back to the raw slug
                      only if we don't recognise it. */}
                  {CATEGORIES.find((c) => c.id === product.category)?.name ||
                    product.category}
                </span>
                <h2 className="mt-1 text-lg font-black text-slate-900 leading-tight">
                  {product.name}
                </h2>
                {effectiveWeight && (
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">
                    Pack: {effectiveWeight}
                  </p>
                )}
              </div>

              {/* Variant chips — only shown when the product has 2+ variants */}
              {hasVariants && variants.length > 1 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Choose pack
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {variants.map((v) => {
                      const active = v.id === selectedVariantId;
                      const oos = v.stock <= 0;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setSelectedVariantId(v.id)}
                          disabled={oos}
                          className={`rounded-xl px-3 py-1.5 text-xs font-bold border transition-all ${
                            active
                              ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                          } ${oos ? "opacity-50 line-through" : ""}`}
                        >
                          {v.label}
                          <span className={`ml-1.5 text-[10px] font-black ${active ? "text-emerald-700" : "text-slate-500"}`}>
                            ₹{v.price}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Rating & Speed */}
              <div className="flex items-center gap-2">
                {product.rating && (
                  <div className="flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-800">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    {product.rating}
                  </div>
                )}
                {product.deliveryTime && (
                  <div className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                    <Clock className="h-3.5 w-3.5 text-emerald-600" />
                    {product.deliveryTime}
                  </div>
                )}
              </div>

              {/* Pricing & Stock Availability */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-slate-900">
                    ₹{effectivePrice}
                  </span>
                  {effectiveOriginal && effectiveOriginal > effectivePrice && (
                    <>
                      <span className="text-xs text-slate-400 line-through">
                        ₹{effectiveOriginal}
                      </span>
                      {discount > 0 && (
                        <span className="text-[11px] font-black text-emerald-700">
                          {discount}% OFF
                        </span>
                      )}
                    </>
                  )}
                </div>

                {/* Real-time Stock Badge */}
                <div className="mt-2">
                  {isOutOfStock ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-700">
                      <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
                      Currently Out of Stock
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      In Stock ({effectiveStock} available)
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          {product.description && (
            <div className="space-y-1.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Product Overview
              </h3>
              <p className="text-xs leading-relaxed text-slate-600">
                {product.description}
              </p>
            </div>
          )}

          {/* Nutritional Facts Grid */}
          {product.nutritionalInfo && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Flame className="h-3.5 w-3.5 text-amber-500" />
                Nutritional Values (Approx per 100g)
              </h3>
              <div className="grid grid-cols-4 gap-2 rounded-2xl bg-slate-50 p-3 text-center border border-slate-100">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Energy</p>
                  <p className="text-xs font-extrabold text-slate-800 mt-0.5">
                    {product.nutritionalInfo.calories}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Protein</p>
                  <p className="text-xs font-extrabold text-slate-800 mt-0.5">
                    {product.nutritionalInfo.protein}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Carbs</p>
                  <p className="text-xs font-extrabold text-slate-800 mt-0.5">
                    {product.nutritionalInfo.carbs}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Fat</p>
                  <p className="text-xs font-extrabold text-slate-800 mt-0.5">
                    {product.nutritionalInfo.fat}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Fresh Guarantee */}
          <div className="flex items-center gap-2 rounded-2xl bg-emerald-50/80 p-3.5 text-xs text-emerald-900 border border-emerald-100">
            <ShieldCheck className="h-5 w-5 text-emerald-600 flex-shrink-0" />
            <div>
              <p className="font-bold">100% Quality & Freshness Guarantee</p>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                If you are not completely satisfied, instant replacement or refund is guaranteed.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Action Bar — flex-shrink-0 pins it below the scrollable
            body so the price + CTA stay visible while the shopper reads
            the ingredients / nutrition sections. */}
        <div className="flex-shrink-0 border-t border-slate-100 bg-slate-50 p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400">Total Price</p>
            <p className="text-base font-black text-slate-900">₹{product.price}</p>
          </div>

          <div>
            {isOutOfStock ? (
              <button
                disabled
                className="rounded-xl bg-slate-200 px-6 py-3 text-xs font-bold text-slate-500 cursor-not-allowed"
              >
                Out of Stock
              </button>
            ) : quantity === 0 ? (
              <button
                onClick={() => addItem(product, selectedVariant)}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-xs font-extrabold text-white shadow-md shadow-emerald-600/30 hover:bg-emerald-500 active:scale-95 transition-all"
              >
                <Plus className="h-4 w-4" /> Add to Basket
              </button>
            ) : (
              <div className="flex items-center rounded-xl bg-emerald-600 text-white shadow-md">
                <button
                  onClick={() => decreaseQuantity(product.id)}
                  className="px-3 py-2.5 text-xs font-bold hover:bg-emerald-700 rounded-l-xl"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-8 text-center text-xs font-black">
                  {quantity}
                </span>
                <button
                  onClick={() => addItem(product, selectedVariant)}
                  className="px-3 py-2.5 text-xs font-bold hover:bg-emerald-700 rounded-r-xl"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Swipeable PDP image gallery. Uses CSS scroll-snap for native touch handling
 * (no runtime carousel dep) plus a dot pager. When only one image is given
 * the dots hide and it renders exactly like the old single-image view.
 */
function ImageCarousel({
  images,
  alt,
  discount,
  hadError,
  onFail,
}: {
  images: string[];
  alt: string;
  discount: number;
  hadError: boolean;
  onFail: () => void;
}) {
  const [active, setActive] = useState(0);
  // Per-slide error set — a single broken image should not blank the entire
  // carousel. Only when EVERY slide fails do we fall back to the 📦 glyph.
  const [failedIndices, setFailedIndices] = useState<Set<number>>(new Set());
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    // Slide-per-frame math: which slide is closest to scrollLeft
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx !== active) setActive(idx);
  };

  const jump = (i: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  const usable = images.length > 0 ? images : [];
  const hasMany = usable.length > 1;
  const allFailed = usable.length > 0 && failedIndices.size >= usable.length;

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="relative flex aspect-square w-full snap-x snap-mandatory overflow-x-auto rounded-2xl border border-slate-100 bg-slate-50 no-scrollbar"
      >
        {discount > 0 && (
          <span className="absolute left-3 top-3 z-10 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
            {discount}% OFF
          </span>
        )}
        {usable.length === 0 || allFailed ? (
          <span className="mx-auto flex items-center justify-center text-6xl">📦</span>
        ) : (
          usable.map((src, i) => (
            <div
              key={`${src}-${i}`}
              className="relative aspect-square w-full flex-shrink-0 snap-center"
            >
              <Image
                src={src}
                alt={`${alt} ${i + 1}`}
                fill
                unoptimized
                className="object-cover"
                onError={() => {
                  setFailedIndices((prev) => {
                    const next = new Set(prev);
                    next.add(i);
                    return next;
                  });
                  // Still notify the parent for legacy state, but do not
                  // let it blank the whole gallery.
                  onFail();
                }}
              />
            </div>
          ))
        )}
      </div>

      {hasMany && (
        <div className="mt-2 flex items-center justify-center gap-1.5">
          {usable.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Show image ${i + 1}`}
              onClick={() => jump(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === active ? "w-5 bg-emerald-600" : "w-1.5 bg-slate-300 hover:bg-slate-400"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
