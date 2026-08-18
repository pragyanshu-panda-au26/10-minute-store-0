"use client";

import { AdminOrder, OrderStatus } from "@/lib/adminDummyData";
import {
  Clock,
  PackageCheck,
  Truck,
  CheckCircle2,
  MapPin,
  Boxes,
  ArrowRight,
} from "lucide-react";

interface KanbanOrderBoardProps {
  orders: AdminOrder[];
  onSelectOrder: (order: AdminOrder) => void;
  onUpdateStatus: (orderId: string, status: OrderStatus) => void;
}

const NEXT_STATUS: Record<OrderStatus, OrderStatus | null> = {
  pending: "confirmed",
  confirmed: "packed",
  packed: "out_for_delivery",
  out_for_delivery: "delivered",
  delivered: null,
  cancelled: null,
};

const NEXT_LABEL: Record<OrderStatus, string> = {
  pending: "Confirm",
  confirmed: "Mark packed",
  packed: "Head out",
  out_for_delivery: "Delivered",
  delivered: "Done",
  cancelled: "Cancelled",
};

export default function KanbanOrderBoard({
  orders,
  onSelectOrder,
  onUpdateStatus,
}: KanbanOrderBoardProps) {
  const columns: { id: OrderStatus; label: string; icon: any; color: string }[] = [
    { id: "pending", label: "Pending", icon: Clock, color: "text-amber-400" },
    { id: "confirmed", label: "Confirmed", icon: PackageCheck, color: "text-blue-400" },
    { id: "packed", label: "Packed", icon: Boxes, color: "text-indigo-400" },
    { id: "out_for_delivery", label: "Out for Delivery", icon: Truck, color: "text-purple-400" },
    { id: "delivered", label: "Delivered", icon: CheckCircle2, color: "text-emerald-400" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black tracking-tight text-slate-100">
          Order Board
        </h2>
        <p className="text-xs text-slate-400">
          Track every order from placed to delivered. Tap a card to open details, or use the quick action to move it forward.
        </p>
      </div>

      {/* Horizontal-scroll on mobile, grid on desktop */}
      <div className="flex gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-5 md:overflow-visible no-scrollbar">
        {columns.map((col) => {
          const colOrders = orders.filter((o) => o.status === col.id);
          const Icon = col.icon;
          return (
            <div
              key={col.id}
              className="flex w-72 flex-shrink-0 flex-col rounded-2xl border border-slate-800 bg-slate-950/60 p-4 min-h-[500px] md:w-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${col.color}`} />
                  <h3 className="text-xs font-black uppercase text-slate-200">
                    {col.label}
                  </h3>
                </div>
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                  {colOrders.length}
                </span>
              </div>

              <div className="space-y-3 flex-1 overflow-y-auto">
                {colOrders.map((ord) => {
                  const next = NEXT_STATUS[ord.status];
                  return (
                    <div
                      key={ord.id}
                      className="rounded-xl border border-slate-800 bg-slate-900 p-3.5 space-y-2 hover:border-slate-700 transition-all cursor-pointer"
                      onClick={() => onSelectOrder(ord)}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-black text-white">
                          #{ord.orderNumber ?? ord.id}
                        </span>
                        <span className="text-[10px] font-extrabold text-emerald-400">
                          ₹{ord.totalPrice}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-200 line-clamp-1">
                        {ord.customerName}
                      </p>
                      <p className="text-[11px] text-slate-400 flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-rose-400 flex-shrink-0" />
                        <span className="truncate">{ord.deliveryAddress}</span>
                      </p>

                      {next && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdateStatus(ord.orderNumber ?? ord.id, next);
                          }}
                          className="w-full flex items-center justify-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-600/15 py-1.5 text-[11px] font-extrabold text-emerald-300 hover:bg-emerald-600/25 active:scale-95"
                        >
                          {NEXT_LABEL[ord.status]}
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
                {colOrders.length === 0 && (
                  <p className="text-center text-[11px] text-slate-600 py-6">
                    Nothing here yet.
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
