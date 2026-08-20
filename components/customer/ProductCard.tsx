"use client";

import Image from "next/image";
import { Product, useCartStore } from "@/store/useCartStore";
import { Plus, Minus, Clock, Star } from "lucide-react";
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
      className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-3.5 shadow-2xs transition-all duration-300 hover:-translate-y-1 hover:border-emerald-300/80 hover:shadow-xl cursor-pointer touch-manipulation"
    >
      {/* Discount Badge */}
      {discount > 0 && (
        <span className="absolute left-3 top-3 z-10 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-2.5 py-0.5 text-[9px] sm:text-[10px] font-black text-white shadow-xs pointer-events-none">
          {discount}% OFF
        </span>
      )}

      {/* Delivery Time Badge */}
      {product.deliveryTime && (
        <span className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full bg-slate-950/80 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold text-white backdrop-blur-md border border-white/10 pointer-events-none">
          <Clock className="h-2.5 w-2.5 text-amber-400" />
          {product.deliveryTime}
        </span>
      )}

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

        {/* Pricing & Add to Cart Controls */}
        <div className="mt-3 flex items-center justify-between pt-1">
          <div className="flex flex-col">
            <div className="flex items-baseline gap-1">
              <span className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                ₹{product.price}
              </span>
              {product.originalPrice && (
                <span className="text-[10px] sm:text-xs text-slate-400 line-through font-medium">
                  ₹{product.originalPrice}
                </span>
              )}
            </div>
          </div>

          {/* Quantity Controls / ADD button */}
          <div onClick={(e) => e.stopPropagation()} className="relative z-20">
            {quantity === 0 ? (
              <button
                type="button"
                onClick={handleAdd}
                disabled={isOutOfStock}
                className={`flex items-center gap-1 rounded-xl border px-3.5 py-1.5 text-xs font-black shadow-2xs transition-all active:scale-90 cursor-pointer touch-manipulation ${
                  isOutOfStock
                    ? "border-slate-300 bg-slate-100 text-slate-400 cursor-not-allowed"
                    : "border-emerald-600 bg-emerald-50/90 text-emerald-700 hover:bg-emerald-600 hover:text-white"
                }`}
              >
                <Plus className="h-3.5 w-3.5" />
                {isOutOfStock ? "OUT" : "ADD"}
              </button>
            ) : (
              <div className="flex items-center rounded-xl bg-emerald-600 text-white shadow-md">
                <button
                  type="button"
                  onClick={handleMinus}
                  className="flex h-7 w-7 items-center justify-center hover:bg-emerald-700 rounded-l-xl active:scale-90 cursor-pointer touch-manipulation"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-6 text-center text-xs font-black">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={atMax}
                  title={atMax ? `Only ${stock} in stock` : undefined}
                  className="flex h-7 w-7 items-center justify-center hover:bg-emerald-700 rounded-r-xl active:scale-90 cursor-pointer touch-manipulation disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
