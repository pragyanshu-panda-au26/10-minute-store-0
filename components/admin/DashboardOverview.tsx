"use client";

import { useCallback, useEffect, useState } from "react";
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
  ArrowDownRight,
  ShoppingCart,
  ChevronRight,
  Users,
  Package,
  Award,
} from "lucide-react";

interface DashboardOverviewProps {
  orders: AdminOrder[];
  onSelectOrder: (order: AdminOrder) => void;
}

interface AnalyticsResponse {
  window: { days: number; since: string; until: string };
  revenue: { grossRupees: number; refundedRupees: number; netRupees: number; aovRupees: number };
  counts: {
    orders: number;
    paid: number;
    pending: number;
    cancelled: number;
    delivered: number;
    abandoned: number;
    customers: number;
    lowStock: number;
    openTickets: number;
  };
  perHourToday: { hour: number; orders: number; revenue: number }[];
  perDay: { date: string; orders: number; revenue: number }[];
  topProducts: { id: string; name: string; quantity: number; revenue: number }[];
}

/**
 * Executive dashboard.
 *
 * Two data sources:
 *   • `orders` prop — the live poll from useOrderStore. Powers the "on the
 *     way" and "needs packing" tiles + the activity feed at the bottom.
 *   • /api/admin/analytics — window-rolled numbers the owner asked for
 *     (revenue net-of-refunds, AOV, per-hour trend, top sellers). Refreshed
 *     every 60s independently of the orders poll.
 */
export default function DashboardOverview({ orders, onSelectOrder }: DashboardOverviewProps) {
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/analytics?days=7", { credentials: "include" });
      const data = await res.json();
      if (data.success) setAnalytics(data as AnalyticsResponse);
    } catch (err) {
      // Non-fatal — tiles fall back to the derived-from-orders numbers below.
      console.warn("[admin] analytics fetch failed:", err);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  // Fallbacks derived from the orders poll — used before analytics arrives
  // AND when /api/admin/analytics is down. Keeps the dashboard useful even
  // if that endpoint is unreachable.
  const outForDelivery = orders.filter((o) => o.status === "out_for_delivery").length;
  const pendingDispatches = orders.filter(
    (o) => o.status === "pending" || o.status === "confirmed" || o.status === "packed"
  ).length;
  const fallbackRevenue = orders
    .filter((o) => o.status === "delivered" || o.status === "out_for_delivery")
    .reduce((acc, o) => acc + o.totalPrice, 0);

  const netRevenue = analytics?.revenue.netRupees ?? fallbackRevenue;
  const aov = analytics?.revenue.aovRupees ?? 0;
  const ordersInWindow = analytics?.counts.orders ?? orders.length;
  const abandoned = analytics?.counts.abandoned ?? 0;
  const customersTotal = analytics?.counts.customers ?? 0;
  const lowStock = analytics?.counts.lowStock ?? 0;
  const openTickets = analytics?.counts.openTickets ?? 0;

  // Week-over-week trend proxy: compare last-day to previous-day revenue.
  // Not statistically rigorous — good enough for a directional arrow.
  const trendPct = (() => {
    const per = analytics?.perDay;
    if (!per || per.length < 2) return null;
    const last = per[per.length - 1].revenue;
    const prev = per[per.length - 2].revenue;
    if (prev === 0) return last > 0 ? 100 : 0;
    return Math.round(((last - prev) / prev) * 100);
  })();

  // Sparkline max for per-hour bars — never divide by zero.
  const hourMax = Math.max(1, ...(analytics?.perHourToday.map((h) => h.orders) ?? [1]));

  const activityLogs = orders.slice(0, 6).map((o, idx) => ({
    id: idx,
    time: new Date(o.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    event: `#${o.orderNumber ?? o.id} — ${o.customerName} · ₹${o.totalPrice} · ${o.status}`,
    order: o,
  }));

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h2 className="text-xl font-black tracking-tight text-slate-100">
          Executive Operations Overview
        </h2>
        <p className="text-xs text-slate-400">
          Rolling 7-day view. Live counters update every 20 s; roll-up refreshes every 60 s.
        </p>
      </div>

      {/* Metric Cards Grid — first row: revenue + counts */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Revenue — net of refunds */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              7d net revenue
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-xl font-black text-white">₹{netRevenue.toLocaleString("en-IN")}</span>
            {trendPct !== null && (
              <span
                className={`flex items-center text-xs font-bold ${
                  trendPct >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {trendPct >= 0 ? "+" : ""}
                {trendPct}%
                {trendPct >= 0 ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : (
                  <ArrowDownRight className="h-3 w-3" />
                )}
              </span>
            )}
          </div>
          {analytics && (
            <p className="mt-1 text-[10px] text-slate-500">
              Refunds ₹{analytics.revenue.refundedRupees.toLocaleString("en-IN")} · AOV ₹{aov.toLocaleString("en-IN")}
            </p>
          )}
        </div>

        {/* Orders in window */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              7d orders
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
              <ShoppingBag className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-xl font-black text-white">{ordersInWindow}</span>
            {analytics && (
              <span className="text-[11px] text-slate-400 font-semibold">
                {analytics.counts.paid} paid
              </span>
            )}
          </div>
          {analytics && (
            <p className="mt-1 text-[10px] text-slate-500">
              {analytics.counts.cancelled} cancelled · {analytics.counts.delivered} delivered
            </p>
          )}
        </div>

        {/* Abandoned — replaces the "3 Active" hardcode */}
        <Link
          href="/admin/abandoned-carts"
          className="rounded-2xl border border-amber-500/40 bg-amber-950/40 p-5 shadow-lg hover:border-amber-400 transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">
              Abandoned (30m+)
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
              <ShoppingCart className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-xl font-black text-amber-400">{abandoned}</span>
            <span className="text-xs text-amber-300 font-bold group-hover:translate-x-1 transition-transform flex items-center">
              View <ChevronRight className="h-3 w-3" />
            </span>
          </div>
        </Link>

        {/* On the way */}
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

        {/* Needs packing */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Needs packing
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400">
              <PackageCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-xl font-black text-white">{pendingDispatches}</span>
            <span className="text-xs text-amber-400 font-bold">Action</span>
          </div>
        </div>
      </div>

      {/* Second row: customers, low-stock, open-tickets — the ops-health strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
            <Users className="h-3.5 w-3.5 text-emerald-400" /> Customers
          </div>
          <p className="mt-2 text-lg font-black text-white">
            {customersTotal.toLocaleString("en-IN")}
          </p>
        </div>
        <Link
          href="/admin/inventory"
          className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 hover:border-rose-500/50 transition-colors"
        >
          <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
            <Package className="h-3.5 w-3.5 text-rose-400" /> Low stock (≤5)
          </div>
          <p className={`mt-2 text-lg font-black ${lowStock > 0 ? "text-rose-400" : "text-white"}`}>
            {lowStock}
          </p>
        </Link>
        <Link
          href="/admin/support"
          className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 hover:border-emerald-500/50 transition-colors"
        >
          <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
            <Activity className="h-3.5 w-3.5 text-emerald-400" /> Open tickets
          </div>
          <p className="mt-2 text-lg font-black text-white">{openTickets}</p>
        </Link>
      </div>

      {/* Per-hour orders bar strip + top sellers, side-by-side on wide */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Per-hour today */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-white">Orders today, by hour</h3>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Local time
            </span>
          </div>
          <div className="flex items-end gap-1 h-24">
            {(analytics?.perHourToday ?? []).map((h) => {
              const heightPct = (h.orders / hourMax) * 100;
              return (
                <div
                  key={h.hour}
                  className="flex-1 flex flex-col items-center justify-end gap-1"
                  title={`${h.hour.toString().padStart(2, "0")}:00 — ${h.orders} orders · ₹${h.revenue.toLocaleString("en-IN")}`}
                >
                  <div
                    className={`w-full rounded-t-sm ${
                      h.orders > 0 ? "bg-emerald-500" : "bg-slate-800"
                    }`}
                    style={{ height: `${Math.max(4, heightPct)}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] font-mono text-slate-500">
            <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
          </div>
        </div>

        {/* Top sellers */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-extrabold text-white">Top sellers (7d)</h3>
          </div>
          {(!analytics || analytics.topProducts.length === 0) ? (
            <p className="text-xs text-slate-500 py-4">
              No sales in the window yet.
            </p>
          ) : (
            <ol className="space-y-1.5">
              {analytics.topProducts.slice(0, 5).map((p, i) => (
                <li key={p.id} className="flex items-center gap-2 text-xs">
                  <span className="w-4 text-right font-mono text-slate-500">{i + 1}</span>
                  <span className="flex-1 truncate text-slate-200 font-medium">{p.name}</span>
                  <span className="text-slate-400 font-mono">{p.quantity}×</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* Activity Feed Section */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-400" />
            <h3 className="text-sm font-extrabold text-white">Latest orders</h3>
          </div>
          <span className="flex items-center gap-1 rounded-full bg-emerald-950 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-800">
            <Zap className="h-3 w-3" /> Auto-refresh
          </span>
        </div>

        <div className="space-y-2.5 divide-y divide-slate-800/60">
          {activityLogs.length === 0 && (
            <p className="text-xs text-slate-500 py-2">
              Quiet. New orders will appear here as they land.
            </p>
          )}
          {activityLogs.map((log) => (
            <button
              key={log.id}
              onClick={() => onSelectOrder(log.order)}
              className="w-full pt-2.5 flex items-center justify-between text-xs text-left hover:text-white"
            >
              <div className="flex items-center gap-2.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span className="text-slate-200 font-medium">{log.event}</span>
              </div>
              <span className="text-[11px] font-mono text-slate-500">{log.time}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
