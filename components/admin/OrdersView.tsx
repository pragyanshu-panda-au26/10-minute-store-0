"use client";

import { useState } from "react";
import { AdminOrder, OrderStatus } from "@/lib/adminDummyData";
import {
  Clock,
  MapPin,
  ShoppingBag,
  ArrowRight,
  Zap,
  CheckCircle2,
  Truck,
  PackageCheck,
  Boxes,
  XCircle,
  Search,
  Calendar,
  X,
} from "lucide-react";

interface OrdersViewProps {
  orders: AdminOrder[];
  onSelectOrder: (order: AdminOrder) => void;
}

const BADGES: Record<OrderStatus, { className: string; label: string; Icon: any }> = {
  pending:          { className: "bg-amber-500/20 text-amber-400 border-amber-500/30",   label: "Pending",          Icon: Clock },
  confirmed:        { className: "bg-blue-500/20 text-blue-400 border-blue-500/30",       label: "Confirmed",        Icon: PackageCheck },
  packed:           { className: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30", label: "Packed",           Icon: Boxes },
  out_for_delivery: { className: "bg-purple-500/20 text-purple-400 border-purple-500/30", label: "Out for Delivery", Icon: Truck },
  delivered:        { className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", label: "Delivered",     Icon: CheckCircle2 },
  cancelled:        { className: "bg-rose-500/20 text-rose-400 border-rose-500/30",       label: "Cancelled",        Icon: XCircle },
};

export default function OrdersView({ orders, onSelectOrder }: OrdersViewProps) {
  const [filterStatus, setFilterStatus] = useState<"all" | OrderStatus>("all");
  const [searchQ, setSearchQ] = useState("");
  const [dateFrom, setDateFrom] = useState<string>(""); // YYYY-MM-DD
  const [dateTo, setDateTo] = useState<string>("");

  const q = searchQ.trim().toLowerCase();
  const fromTs = dateFrom ? new Date(dateFrom + "T00:00:00").getTime() : null;
  const toTs = dateTo ? new Date(dateTo + "T23:59:59").getTime() : null;

  const filteredOrders = orders.filter((order) => {
    if (filterStatus !== "all" && order.status !== filterStatus) return false;
    if (q) {
      const hay = `${order.orderNumber ?? ""} ${order.id} ${order.customerName} ${order.customerPhone}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (fromTs || toTs) {
      const ts = new Date(order.createdAt).getTime();
      if (fromTs && ts < fromTs) return false;
      if (toTs && ts > toTs) return false;
    }
    return true;
  });

  const getStatusBadge = (status: OrderStatus) => {
    const b = BADGES[status];
    const Icon = b.Icon;
    return (
      <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold border ${b.className}`}>
        <Icon className="h-3 w-3" /> {b.label}
      </span>
    );
  };

  const tabs: { id: "all" | OrderStatus; label: string }[] = [
    { id: "all", label: "All" },
    { id: "pending", label: "Pending" },
    { id: "confirmed", label: "Confirmed" },
    { id: "packed", label: "Packed" },
    { id: "out_for_delivery", label: "Out for Delivery" },
    { id: "delivered", label: "Delivered" },
    { id: "cancelled", label: "Cancelled" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black tracking-tight text-slate-100">Live Order Feed</h2>
            <span className="flex items-center gap-1 rounded-full bg-emerald-950 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-800">
              <Zap className="h-3 w-3 fill-emerald-400" /> Real-time
            </span>
          </div>
          <p className="text-xs text-slate-400">All incoming orders — you deliver them yourself.</p>
        </div>
      </div>

      {/* Search + date range */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="search"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Search by order #, name, phone…"
            className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2 pl-9 pr-9 text-xs text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
          />
          {searchQ && (
            <button
              onClick={() => setSearchQ("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-800"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950 px-2 py-1.5">
          <Calendar className="h-3.5 w-3.5 text-slate-500 ml-1" />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="bg-transparent text-xs text-white focus:outline-none"
          />
          <span className="text-slate-600 text-xs">→</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-transparent text-xs text-white focus:outline-none"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(""); setDateTo(""); }}
              className="rounded-full p-1 text-slate-400 hover:bg-slate-800"
              aria-label="Clear date filter"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {tabs.map((tab) => {
          const count = tab.id === "all" ? orders.length : orders.filter((o) => o.status === tab.id).length;
          const isActive = filterStatus === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all flex-shrink-0 ${
                isActive ? "bg-emerald-600 text-white shadow-md" : "bg-slate-900 text-slate-400 border border-slate-800 hover:bg-slate-800"
              }`}
            >
              <span>{tab.label}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] ${isActive ? "bg-emerald-950 text-emerald-300" : "bg-slate-800 text-slate-400"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {filteredOrders.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredOrders.map((order) => (
            <div
              key={order.id}
              onClick={() => onSelectOrder(order)}
              className="group flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg transition-all hover:-translate-y-1 hover:border-emerald-500/50 cursor-pointer"
            >
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-black text-white">#{order.orderNumber ?? order.id}</span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      • {new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  {getStatusBadge(order.status)}
                </div>
                <div className="mt-3 space-y-1.5">
                  <p className="text-sm font-bold text-slate-100">{order.customerName}</p>
                  <p className="text-xs text-slate-400 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-rose-400 flex-shrink-0" />
                    <span className="truncate">{order.deliveryAddress}</span>
                  </p>
                  {order.scheduledFor && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2 py-0.5 text-[10px] font-black">
                      <Clock className="h-3 w-3" />
                      Scheduled · {new Date(order.scheduledFor).toLocaleString("en-IN", {
                        weekday: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                      })}
                    </span>
                  )}
                </div>
                <div className="mt-4 rounded-xl bg-slate-950/60 p-3 border border-slate-800/80">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-300">
                      <ShoppingBag className="h-3.5 w-3.5 text-emerald-400" /> {order.totalItems} items
                    </span>
                    <span className="text-xs font-black text-emerald-400">₹{order.totalPrice}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-1">
                    {order.items.map((i) => `${i.quantity}x ${i.name}`).join(", ")}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-800 text-xs font-extrabold text-emerald-400 group-hover:text-emerald-300">
                <span>Open details</span>
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex min-h-[250px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-8 text-center">
          <ShoppingBag className="mb-2 h-10 w-10 text-slate-600" />
          <p className="text-sm font-bold text-slate-400">No orders match this filter.</p>
        </div>
      )}
    </div>
  );
}
