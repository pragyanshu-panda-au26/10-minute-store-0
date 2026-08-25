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
    brand: (p as any).brand ?? null,
    category: p.category,
    subcategory: p.subcategory ?? undefined,
    price: p.price,
    originalPrice: p.originalPrice ?? undefined,
    costPrice: p.costPrice ?? undefined,
    stock: p.stock ?? 25,
    imageUrl: p.imageUrl,
    // API returns images always-with-primary-leading; strip the primary so
    // the admin edit form re-hydrates "additional" images distinctly.
    images: ((p as any).images ?? []).filter((u: string) => u !== p.imageUrl),
    weight: p.weight || "1 unit",
    tags: p.tags,
    ratingCount: (p as any).ratingCount ?? 0,
    type: (p as any).type ?? null,
    shelfLife: (p as any).shelfLife ?? null,
    countryOfOrigin: (p as any).countryOfOrigin ?? null,
    ingredients: (p as any).ingredients ?? null,
    nutrition: (p as any).nutrition ?? null,
    variants: (((p as any).variants ?? []) as any[]).map((v: any) => ({
      id: v.id,
      sku: v.sku,
      label: v.label,
      price: v.price,
      originalPrice: v.originalPrice ?? null,
      stock: v.stock,
      isDefault: v.isDefault,
      sortOrder: v.sortOrder,
    })),
  }));

  /**
   * Post-save hook that syncs the variant table for a product. Called
   * after createProduct / updateProduct returns. Skips the round-trip
   * entirely when the admin didn't touch variants (undefined) — an
   * explicit empty array still fires because that's "delete all variants",
   * which is a meaningful action.
   */
  const syncVariants = async (
    productId: string,
    variants: AdminProduct["variants"] | undefined
  ) => {
    if (!variants) return; // undefined = no change
    const res = await fetch(`/api/products/${productId}/variants`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variants }),
    });
    if (!res.ok) {
      console.warn("Variant sync failed:", await res.text());
    }
    // Refresh the catalog so admin table shows the new "options" count and
    // the customer PDP variant picker pulls the fresh set.
    await fetchProducts({ includeInactive: true });
  };

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
            onAddProduct={async (np) => {
              // Spread the full Phase B/C payload — brand, images,
              // ratingCount, type, shelfLife, countryOfOrigin, ingredients,
              // nutrition. `variants` is stripped because the products API
              // doesn't accept it; we PUT them separately below.
              const { variants, ...scalar } = np;
              const created = await createProduct({
                name: scalar.name,
                brand: scalar.brand ?? null,
                category: scalar.category,
                price: scalar.price,
                originalPrice: scalar.originalPrice,
                costPrice: scalar.costPrice,
                stock: scalar.stock,
                weight: scalar.weight,
                imageUrl: scalar.imageUrl,
                images: scalar.images ?? [],
                tags: scalar.tags,
                ratingCount: scalar.ratingCount,
                type: scalar.type ?? null,
                shelfLife: scalar.shelfLife ?? null,
                countryOfOrigin: scalar.countryOfOrigin ?? null,
                ingredients: scalar.ingredients ?? null,
                nutrition: scalar.nutrition ?? null,
              } as any);
              if (created?.id) {
                await syncVariants(created.id, variants);
              }
            }}
            onUpdateProduct={async (id, fields) => {
              const { variants, ...scalar } = fields as AdminProduct;
              await updateProduct(id, scalar as any);
              await syncVariants(id, variants);
            }}
            onDeleteProduct={(id) => deleteProduct(id).then(() => undefined)}
            onUpdateStock={(id, stock) => updateStock(id, stock).then(() => undefined)}
          />
        </main>
      </div>
    </div>
  );
}
