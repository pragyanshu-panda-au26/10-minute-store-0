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

  const handleCardClick = (e: React.MouseEvent) => {
    if (onSelect) onSelect();
  };

  const handleAddTouch = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    addItem(product);
  };

  const handleMinusTouch = (e: React.MouseEvent | React.TouchEvent) => {
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
                onClick={handleAddTouch}
                onTouchEnd={handleAddTouch}
                className="flex items-center gap-1 rounded-xl border border-emerald-600 bg-emerald-50/90 px-3.5 py-1.5 text-xs font-black text-emerald-700 shadow-2xs transition-all hover:bg-emerald-600 hover:text-white active:scale-90 cursor-pointer touch-manipulation"
              >
                <Plus className="h-3.5 w-3.5" />
                ADD
              </button>
            ) : (
              <div className="flex items-center rounded-xl bg-emerald-600 text-white shadow-md">
                <button
                  type="button"
                  onClick={handleMinusTouch}
                  onTouchEnd={handleMinusTouch}
                  className="flex h-7 w-7 items-center justify-center hover:bg-emerald-700 rounded-l-xl active:scale-90 cursor-pointer touch-manipulation"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-6 text-center text-xs font-black">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={handleAddTouch}
                  onTouchEnd={handleAddTouch}
                  className="flex h-7 w-7 items-center justify-center hover:bg-emerald-700 rounded-r-xl active:scale-90 cursor-pointer touch-manipulation"
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
