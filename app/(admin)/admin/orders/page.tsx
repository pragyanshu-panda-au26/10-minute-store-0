"use client";

import { useEffect, useState } from "react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import KanbanOrderBoard from "@/components/admin/KanbanOrderBoard";
import OrderDetailsModal from "@/components/admin/OrderDetailsModal";
import { AdminOrder, OrderStatus } from "@/lib/adminDummyData";
import { useOrderStore } from "@/store/useOrderStore";
import { Menu } from "lucide-react";

export default function AdminOrdersPage() {
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [isOpenMobile, setIsOpenMobile] = useState(false);
  const { orders, subscribeAdminStream, updateOrderStatus } = useOrderStore();

  useEffect(() => {
    // Live server-sent events feed. Replaces the old 20 s poll loop.
    return subscribeAdminStream();
  }, [subscribeAdminStream]);

  const handleUpdateStatus = async (id: string, status: OrderStatus) => {
    await updateOrderStatus(id, status);
    if (selectedOrder && (selectedOrder.id === id || selectedOrder.orderNumber === id)) {
      setSelectedOrder((prev) => (prev ? { ...prev, status } : null));
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <AdminSidebar
        activeTab="orders"
        setActiveTab={() => {}}
        pendingOrdersCount={orders.filter((o) => o.status === "pending").length}
        lowStockCount={2}
        isOpenMobile={isOpenMobile}
        setIsOpenMobile={setIsOpenMobile}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-800 bg-slate-950/90 px-5 py-3.5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsOpenMobile(true)}
              className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-400 md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-base font-black text-white">Live Order Kanban Board</h1>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
          <KanbanOrderBoard
            orders={orders}
            onSelectOrder={(ord) => setSelectedOrder(ord)}
            onUpdateStatus={handleUpdateStatus}
          />
        </main>

        <OrderDetailsModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdateStatus={handleUpdateStatus}
        />
      </div>
    </div>
  );
}
