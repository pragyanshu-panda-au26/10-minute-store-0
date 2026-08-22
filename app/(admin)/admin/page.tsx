"use client";

import { useEffect, useState } from "react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import DashboardOverview from "@/components/admin/DashboardOverview";
import OrderDetailsModal from "@/components/admin/OrderDetailsModal";
import { AdminOrder, OrderStatus } from "@/lib/adminDummyData";
import { useProductStore } from "@/store/useProductStore";
import { useOrderStore } from "@/store/useOrderStore";
import { useNewOrderAlert } from "@/components/admin/useNewOrderAlert";
import { Menu, ShieldCheck, ShoppingBag, TrendingUp, Radio } from "lucide-react";

/**
 * /admin — dashboard hub. Every other admin surface (orders board, inventory,
 * customers, coupons, banners, delivery rules, abandoned carts, dark stores,
 * support, settings) lives on its own route under /admin/<slug>. The sidebar
 * navigates to those pages via <Link>, so this route just needs to be the
 * dashboard. The old in-page tab-switch has been retired — it was dead code
 * once each tab got its own page.
 */
export default function AdminPage() {
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [isOpenMobile, setIsOpenMobile] = useState(false);

  const {
    orders,
    loading: ordersLoading,
    subscribeAdminStream,
    updateOrderStatus,
  } = useOrderStore();

  const { products, fetchProducts } = useProductStore();

  // SSE for orders (live, no polling), one-shot fetch for products so the
  // low-stock and revenue summaries render without a spinner.
  useEffect(() => {
    fetchProducts({ includeInactive: true });
    return subscribeAdminStream();
  }, [subscribeAdminStream, fetchProducts]);

  // New-order audio + browser notification
  const alert = useNewOrderAlert(orders);

  const handleUpdateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    await updateOrderStatus(orderId, newStatus);
    if (
      selectedOrder &&
      (selectedOrder.id === orderId || selectedOrder.orderNumber === orderId)
    ) {
      setSelectedOrder((prev) => (prev ? { ...prev, status: newStatus } : null));
    }
  };

  const pendingOrdersCount = orders.filter((o) => o.status === "pending").length;
  const lowStockCount = products.filter((p) => (p.stock ?? 10) < 10).length;
  const totalRevenue = orders
    .filter((o) => o.status === "delivered" || o.status === "out_for_delivery")
    .reduce((acc, o) => acc + o.totalPrice, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <AdminSidebar
        activeTab="dashboard"
        setActiveTab={() => {}}
        pendingOrdersCount={pendingOrdersCount}
        lowStockCount={lowStockCount}
        isOpenMobile={isOpenMobile}
        setIsOpenMobile={setIsOpenMobile}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/90 px-5 py-3.5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsOpenMobile(true)}
              className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:bg-slate-800 md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-xs font-bold text-slate-200">
                  Bhubaneswar Store · Owner console
                </span>
                <span className="flex items-center gap-1 rounded-full bg-emerald-950 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-800">
                  <Radio className="h-2.5 w-2.5" />
                  {ordersLoading ? "SYNCING" : "LIVE"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="hidden sm:flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-1.5 border border-slate-800">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              <span className="text-slate-400">Revenue:</span>
              <strong className="text-white font-extrabold">₹{totalRevenue}</strong>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-1.5 border border-slate-800">
              <ShoppingBag className="h-4 w-4 text-amber-400" />
              <span className="hidden sm:inline text-slate-400">Pending:</span>
              <strong className="text-amber-400 font-extrabold">{pendingOrdersCount}</strong>
            </div>
            {alert.needsPermission && (
              <button
                onClick={alert.requestPermission}
                className="hidden sm:flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-[11px] font-black text-white hover:bg-emerald-500 animate-pulse"
                title="Get a ding + notification whenever a new order comes in"
              >
                🔔 Enable new-order alerts
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <DashboardOverview orders={orders} onSelectOrder={setSelectedOrder} />
        </main>

        <footer className="border-t border-slate-900 bg-slate-950 py-4 px-6 text-center text-[11px] text-slate-500">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            <span>Satyug Owner Portal</span>
          </div>
        </footer>
      </div>

      <OrderDetailsModal
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onUpdateStatus={handleUpdateOrderStatus}
      />
    </div>
  );
}
