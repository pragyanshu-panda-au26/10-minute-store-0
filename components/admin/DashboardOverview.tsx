"use client";

import Link from "next/link";
import { AdminOrder } from "@/lib/adminDummyData";
import {
  TrendingUp,
  ShoppingBag,
  Truck,
  PackageCheck,
  Activity,
  Zap,
  ArrowUpRight,
  ShoppingCart,
  ChevronRight,
} from "lucide-react";

interface DashboardOverviewProps {
  orders: AdminOrder[];
  onSelectOrder: (order: AdminOrder) => void;
}

export default function DashboardOverview({
  orders,
  onSelectOrder,
}: DashboardOverviewProps) {
  const todayOrdersCount = orders.length;
  const totalRevenue = orders
    .filter((o) => o.status === "delivered" || o.status === "out_for_delivery")
    .reduce((acc, o) => acc + o.totalPrice, 0);
  const outForDelivery = orders.filter((o) => o.status === "out_for_delivery").length;
  const pendingDispatches = orders.filter(
    (o) => o.status === "pending" || o.status === "confirmed" || o.status === "packed"
  ).length;

  const activityLogs = orders.slice(0, 6).map((o, idx) => ({
    id: idx,
    time: new Date(o.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    event: `#${o.orderNumber ?? o.id} — ${o.customerName} · ₹${o.totalPrice} · ${o.status}`,
  }));

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h2 className="text-xl font-black tracking-tight text-slate-100">
          Executive Operations Overview
        </h2>
        <p className="text-xs text-slate-400">
          Real-time metrics, live abandoned carts tracking & system activity log for Dark Store #01 (Bhubaneswar)
        </p>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Card 1: Revenue */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Today's Revenue
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-xl font-black text-white">₹{totalRevenue}</span>
            <span className="flex items-center text-xs font-bold text-emerald-400">
              +18.4% <ArrowUpRight className="h-3 w-3" />
            </span>
          </div>
        </div>

        {/* Card 2: Orders */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Today's Orders
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
              <ShoppingBag className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-xl font-black text-white">{todayOrdersCount}</span>
            <span className="text-xs text-slate-400 font-semibold">10-min target</span>
          </div>
        </div>

        {/* Card 3: Abandoned Carts */}
        <Link
          href="/admin/abandoned-carts"
          className="rounded-2xl border border-amber-500/40 bg-amber-950/40 p-5 shadow-lg hover:border-amber-400 transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">
              Abandoned Carts
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
              <ShoppingCart className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-xl font-black text-amber-400">3 Active</span>
            <span className="text-xs text-amber-300 font-bold group-hover:translate-x-1 transition-transform flex items-center">
              View <ChevronRight className="h-3 w-3" />
            </span>
          </div>
        </Link>

        {/* Card 4: Out for delivery */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              On the way
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400">
              <Truck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-xl font-black text-white">{outForDelivery}</span>
            <span className="text-xs text-blue-400 font-bold">Out for delivery</span>
          </div>
        </div>

        {/* Card 5: Pending Packing */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Pending Packing
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400">
              <PackageCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-xl font-black text-white">{pendingDispatches}</span>
            <span className="text-xs text-amber-400 font-bold">Needs Action</span>
          </div>
        </div>
      </div>

      {/* Activity Feed Section */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-400" />
            <h3 className="text-sm font-extrabold text-white">
              Real-Time System Activity Feed
            </h3>
          </div>
          <span className="flex items-center gap-1 rounded-full bg-emerald-950 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-800">
            <Zap className="h-3 w-3" /> Live Polling & Stream
          </span>
        </div>

        <div className="space-y-2.5 divide-y divide-slate-800/60">
          {activityLogs.map((log) => (
            <div key={log.id} className="pt-2.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span className="text-slate-200 font-medium">{log.event}</span>
              </div>
              <span className="text-[11px] font-mono text-slate-500">{log.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
