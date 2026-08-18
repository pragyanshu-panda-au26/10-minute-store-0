"use client";

import { useEffect, useState } from "react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import InventoryView from "@/components/admin/InventoryView";
import { useProductStore } from "@/store/useProductStore";
import { AdminProduct } from "@/lib/adminDummyData";
import { Menu } from "lucide-react";

export default function AdminInventoryPage() {
  const [isOpenMobile, setIsOpenMobile] = useState(false);
  const {
    products,
    fetchProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    updateStock,
  } = useProductStore();

  useEffect(() => {
    fetchProducts({ includeInactive: true });
  }, [fetchProducts]);

  const adminProducts: AdminProduct[] = products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    category: p.category,
    subcategory: p.subcategory ?? undefined,
    price: p.price,
    originalPrice: p.originalPrice ?? undefined,
    costPrice: p.costPrice ?? undefined,
    stock: p.stock ?? 25,
    imageUrl: p.imageUrl,
    weight: p.weight || "1 unit",
    tags: p.tags,
  }));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <AdminSidebar
        activeTab="inventory"
        setActiveTab={() => {}}
        pendingOrdersCount={0}
        lowStockCount={products.filter((p) => (p.stock ?? 10) < 10).length}
        isOpenMobile={isOpenMobile}
        setIsOpenMobile={setIsOpenMobile}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-800 bg-slate-950/90 px-5 py-3.5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsOpenMobile(true)}
              className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-400 md:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-base font-black text-white">Catalog &amp; Inventory Control</h1>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
          <InventoryView
            products={adminProducts}
            onAddProduct={(np) =>
              createProduct({
                name: np.name,
                category: np.category,
                price: np.price,
                originalPrice: np.originalPrice,
                costPrice: np.costPrice,
                stock: np.stock,
                weight: np.weight,
                imageUrl: np.imageUrl,
                tags: np.tags,
              }).then(() => undefined)
            }
            onUpdateProduct={(id, fields) => updateProduct(id, fields as any).then(() => undefined)}
            onDeleteProduct={(id) => deleteProduct(id).then(() => undefined)}
            onUpdateStock={(id, stock) => updateStock(id, stock).then(() => undefined)}
          />
        </main>
      </div>
    </div>
  );
}
