"use client";

import Image from "next/image";
import { Product, useCartStore } from "@/store/useCartStore";
import { Plus, Minus, Star } from "lucide-react";
import { useState } from "react";

interface ProductCardProps {
  product: Product;
  onSelect?: () => void;
}

export default function ProductCard({ product, onSelect }: ProductCardProps) {
  const { items, addItem, decreaseQuantity } = useCartStore();
  const cartItem = items.find((i) => i.product.id === product.id);
  const quantity = cartItem ? cartItem.quantity : 0;
  const [imageError, setImageError] = useState(false);

  const discount = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  const handleCardClick = () => {
    if (onSelect) onSelect();
  };

  // Respect the underlying stock. `undefined` means "unknown / uncapped"
  // (legacy dummy data path), so we only block when we have a real number.
  const stock = typeof product.stock === "number" ? product.stock : null;
  const isOutOfStock = stock !== null && stock <= 0;
  const atMax = stock !== null && quantity >= stock;

  // Single-source-of-truth handlers. We deliberately DO NOT wire both onClick
  // AND onTouchEnd — mobile browsers synthesize a click after touchend and
  // that used to double-increment quantity on every tap. onClick alone works
  // on touch devices; we call preventDefault on the touch to suppress the
  // 300ms delay and any duplicate synthesized click.
  const handleAdd = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    if (isOutOfStock || atMax) return;
    addItem(product);
  };

  const handleMinus = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    decreaseQuantity(product.id);
  };

  return (
    <div
      onClick={handleCardClick}
      // "In cart" affordance (UX-11) — a subtle emerald ring around the whole
      // card when quantity > 0 tells the customer at a glance that this item
      // is already in their basket. Recognition beats recall: without it, the
      // stepper alone was the only cue and read as "this card looks different"
      // rather than "you added this".
      className={`group relative flex flex-col justify-between overflow-hidden rounded-3xl border bg-white p-3.5 shadow-2xs transition-all duration-300 hover:-translate-y-1 hover:shadow-xl cursor-pointer touch-manipulation ${
        quantity > 0
          ? "border-emerald-500 ring-2 ring-emerald-500/30 shadow-emerald-500/10"
          : "border-slate-200/90 hover:border-emerald-300/80"
      }`}
    >
      {/* "In cart" ribbon — top-right corner when there's a live quantity.
          Displaces the delivery-time chip so we're not stacking two badges. */}
      {quantity > 0 && (
        <span className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-white shadow-xs pointer-events-none">
          In cart · {quantity}
        </span>
      )}

      {/* Discount Badge */}
      {discount > 0 && (
        <span className="absolute left-3 top-3 z-10 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-2.5 py-0.5 text-[9px] sm:text-[10px] font-black text-white shadow-xs pointer-events-none">
          {discount}% OFF
        </span>
      )}

      {/* UX-12 — per-card "10 min" chip removed. The whole app promises
          10-minute delivery in the header; repeating it on every card
          taught customers to skip the badge as decoration. Delivery time
          still lives on the PDP where it earns its place. */}

      {/* Product Image Container */}
      <div className="relative mb-3 flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl bg-slate-50/80 pointer-events-none">
        {!imageError ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-108"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-slate-100 text-3xl">
            📦
          </div>
        )}
      </div>

      {/* Product Details */}
      <div className="flex flex-1 flex-col justify-between">
        <div>
          {/* Weight / Unit */}
          {product.weight && (
            <p className="text-[10px] sm:text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              {product.weight}
            </p>
          )}

          {/* Title */}
          <h3 className="line-clamp-2 mt-0.5 text-xs sm:text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors leading-snug">
            {product.name}
          </h3>

          {/* Rating */}
          {product.rating && (
            <div className="mt-1 flex items-center gap-1">
              <div className="flex items-center gap-0.5 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] sm:text-[11px] font-extrabold text-amber-800 border border-amber-200/60">
                <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                {product.rating}
              </div>
            </div>
          )}
        </div>

        {/* Pricing row — sits above a full-width action strip so the ADD
            button is centred against the card, not floating in the top-right
            dead zone of the left column. UX-10. */}
        <div className="mt-3 flex items-baseline gap-1.5 pt-1">
          <span className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
            ₹{product.price}
          </span>
          {product.originalPrice && (
            <span className="text-[10px] sm:text-xs text-slate-400 line-through font-medium">
              ₹{product.originalPrice}
            </span>
          )}
        </div>

        {/* Full-width action strip. Fitts's Law: bigger target, centered on
            the card, reachable by either thumb regardless of grip. Replaces
            the small right-corner button from before. */}
        <div onClick={(e) => e.stopPropagation()} className="relative z-20 mt-2">
          {quantity === 0 ? (
            <button
              type="button"
              onClick={handleAdd}
              disabled={isOutOfStock}
              className={`w-full flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-black tracking-wide shadow-2xs transition-all active:scale-[0.97] cursor-pointer touch-manipulation ${
                isOutOfStock
                  ? "border-slate-300 bg-slate-100 text-slate-400 cursor-not-allowed"
                  : "border-emerald-600 bg-emerald-50/90 text-emerald-700 hover:bg-emerald-600 hover:text-white"
              }`}
            >
              <Plus className="h-4 w-4" />
              {isOutOfStock ? "OUT OF STOCK" : "ADD"}
            </button>
          ) : (
            <div className="w-full flex items-center justify-between rounded-xl bg-emerald-600 text-white shadow-md">
              <button
                type="button"
                onClick={handleMinus}
                aria-label="Remove one"
                className="flex h-10 w-11 items-center justify-center hover:bg-emerald-700 rounded-l-xl active:scale-90 cursor-pointer touch-manipulation"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="flex-1 text-center text-sm font-black tabular-nums">
                {quantity}
              </span>
              <button
                type="button"
                onClick={handleAdd}
                disabled={atMax}
                aria-label={atMax ? `Only ${stock} in stock` : "Add one more"}
                title={atMax ? `Only ${stock} in stock` : undefined}
                className="flex h-10 w-11 items-center justify-center hover:bg-emerald-700 rounded-r-xl active:scale-90 cursor-pointer touch-manipulation disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
