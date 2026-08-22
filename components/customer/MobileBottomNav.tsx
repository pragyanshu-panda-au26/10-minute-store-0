"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, History, User } from "lucide-react";

/**
 * Bottom nav — 4 tabs, no Cart tab.
 *
 * UX-14: the floating "N items · View Cart" strip at the bottom of the
 * catalog is the strongest conversion cue for the basket (shows total
 * price, not just count). Having ALSO a Cart tab in the nav split the
 * customer's attention across two identical affordances. The Cart tab
 * is removed in favour of a Categories tab that scrolls straight to the
 * subcategory grid on the home page — a job the nav didn't previously
 * cover.
 */
export default function MobileBottomNav() {
  const pathname = usePathname();

  const navs = [
    { href: "/", label: "Home", icon: Home },
    // Categories deep-link to the mobile category grid. On the home page
    // this scrolls to the grid smoothly; from any other route it navigates
    // to / first and the anchor takes it from there.
    { href: "/#categories", label: "Categories", icon: LayoutGrid },
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
          // Anchor links (#hash) are still on the same pathname. Compare
          // just the path portion so /#categories highlights on the home tab.
          const hrefPath = n.href.split("#")[0] || "/";
          const isActive = pathname === hrefPath && (n.href === hrefPath || pathname === "/");

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
