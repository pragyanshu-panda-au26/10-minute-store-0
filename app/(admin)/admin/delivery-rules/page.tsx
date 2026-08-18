"use client";

import { useState } from "react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import DeliveryRulesView from "@/components/admin/DeliveryRulesView";
import { Menu } from "lucide-react";

export default function AdminDeliveryRulesPage() {
  const [isOpenMobile, setIsOpenMobile] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <AdminSidebar
        activeTab="delivery_rules"
        setActiveTab={() => {}}
        pendingOrdersCount={1}
        lowStockCount={0}
        isOpenMobile={isOpenMobile}
        setIsOpenMobile={setIsOpenMobile}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-800 bg-slate-950/90 px-5 py-3.5 backdrop-blur-md">
          <button
            onClick={() => setIsOpenMobile(true)}
            className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-400 md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-base font-black text-white">Delivery Rules & Geofencing Map</h1>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
          <DeliveryRulesView />
        </main>
      </div>
    </div>
  );
}
