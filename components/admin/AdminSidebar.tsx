"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Users,
  Tag,
  Image as ImageIcon,
  Sliders,
  ShieldCheck,
  X,
  Zap,
  ShoppingCart,
  Building2,
  LogOut,
} from "lucide-react";

export type AdminTab =
  | "dashboard"
  | "orders"
  | "abandoned_carts"
  | "dark_stores"
  | "inventory"
  | "customers"
  | "coupons"
  | "banners"
  | "delivery_rules"
  | "settings";

interface AdminSidebarProps {
  activeTab: AdminTab;
  setActiveTab: (tab: AdminTab) => void;
  pendingOrdersCount: number;
  lowStockCount: number;
  isOpenMobile: boolean;
  setIsOpenMobile: (open: boolean) => void;
}

export default function AdminSidebar({
  activeTab,
  setActiveTab,
  pendingOrdersCount,
  lowStockCount,
  isOpenMobile,
  setIsOpenMobile,
}: AdminSidebarProps) {
  const pathname = usePathname();

  const navItems: { id: AdminTab; href: string; label: string; icon: any; badge?: string | number; color?: string }[] = [
    { id: "dashboard", href: "/admin", label: "Executive Overview", icon: LayoutDashboard },
    { id: "orders", href: "/admin/orders", label: "Live Order Board", icon: ShoppingBag, badge: pendingOrdersCount > 0 ? pendingOrdersCount : undefined, color: "bg-amber-500 text-slate-950" },
    { id: "abandoned_carts", href: "/admin/abandoned-carts", label: "Abandoned Carts", icon: ShoppingCart, badge: 3, color: "bg-amber-400 text-slate-950" },
    { id: "dark_stores", href: "/admin/dark-stores", label: "Dark Store Hubs", icon: Building2, color: "bg-emerald-500 text-slate-950" },
    { id: "inventory", href: "/admin/inventory", label: "Inventory & Catalog", icon: Package, badge: lowStockCount > 0 ? `${lowStockCount} Low` : undefined, color: "bg-rose-500/20 text-rose-400" },
    { id: "customers", href: "/admin/customers", label: "Customer Directory", icon: Users },
    { id: "coupons", href: "/admin/coupons", label: "Coupon Engine", icon: Tag },
    { id: "banners", href: "/admin/banners", label: "Hero Banners", icon: ImageIcon },
    { id: "delivery_rules", href: "/admin/delivery-rules", label: "Delivery Rules & Zone", icon: Sliders },
    { id: "settings", href: "/admin/settings", label: "Store Settings", icon: Sliders, color: "bg-emerald-500/20 text-emerald-400" },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm md:hidden"
          onClick={() => setIsOpenMobile(false)}
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col justify-between border-r border-slate-800 bg-slate-950 text-slate-200 transition-transform duration-300 md:static md:translate-x-0 ${
          isOpenMobile ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="p-5">
          {/* Header & Brand */}
          <div className="flex items-center justify-between pb-6 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 font-black text-xs text-slate-950 shadow-md shadow-emerald-500/20">
                10m
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="text-base font-black tracking-tight text-white">
                    10minute <span className="text-emerald-400">Admin</span>
                  </h1>
                  <span className="flex items-center gap-0.5 rounded-full bg-emerald-950 px-1.5 py-0.5 text-[9px] font-black text-emerald-400 border border-emerald-800/50">
                    <Zap className="h-2.5 w-2.5" /> LIVE
                  </span>
                </div>
                <p className="text-[11px] font-medium text-slate-400">
                  Command Center
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpenMobile(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 md:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <div className="mt-6 space-y-1">
            <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
              Operations Navigation
            </p>

            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.id === activeTab && (pathname === "/admin" || pathname === item.href));

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setIsOpenMobile(false)}
                  className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all ${
                    isActive
                      ? "bg-emerald-600/15 text-emerald-400 border border-emerald-500/30 shadow-sm"
                      : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span
                      className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-black ${
                        item.color || "bg-emerald-500 text-slate-950"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Logout + Disclaimer Footer */}
        <div className="border-t border-slate-800/80 p-4 bg-slate-950/60 space-y-3">
          <button
            onClick={async () => {
              await fetch("/api/admin/logout", { method: "POST" });
              window.location.href = "/admin/login";
            }}
            className="w-full flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-[11px] font-bold text-slate-300">
              10minute store Portal
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
