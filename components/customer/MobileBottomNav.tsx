"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCartStore } from "@/store/useCartStore";
import { Home, ShoppingBag, History, User } from "lucide-react";

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { getTotalItems } = useCartStore();
  const totalItems = getTotalItems();

  const navs = [
    { href: "/", label: "Home", icon: Home },
    { href: "/cart", label: "Cart", icon: ShoppingBag, badge: totalItems > 0 ? totalItems : undefined },
    { href: "/orders", label: "Orders", icon: History },
    { href: "/profile", label: "Profile", icon: User },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl md:hidden transition-colors"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex justify-around items-center h-16 max-w-md mx-auto">
        {navs.map((n) => {
          const Icon = n.icon;
          const isActive = pathname === n.href;

          return (
            <Link
              key={n.href}
              href={n.href}
              className={`relative flex flex-col items-center justify-center w-full h-full text-[10px] font-extrabold transition-all cursor-pointer touch-manipulation active:scale-90 ${
                isActive ? "text-emerald-600 dark:text-emerald-400 font-black" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
              }`}
            >
              <div className="relative">
                <Icon className={`h-5 w-5 transition-transform ${isActive ? "scale-110 text-emerald-600 dark:text-emerald-400" : ""}`} />
                {n.badge !== undefined && (
                  <span className="absolute -right-2 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[9px] font-black text-white shadow-xs animate-pulse">
                    {n.badge}
                  </span>
                )}
              </div>
              <span className="mt-1">{n.label}</span>
              {isActive && <span className="absolute bottom-1 h-1 w-6 rounded-full bg-gradient-to-r from-emerald-600 to-teal-500 shadow-xs" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
