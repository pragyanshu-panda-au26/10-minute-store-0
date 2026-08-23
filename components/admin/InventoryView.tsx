"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { AdminProduct } from "@/lib/adminDummyData";
import { CATEGORIES, Category } from "@/lib/dummyData";
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Layers,
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  FileText,
  ImageIcon,
  Loader2,
  CloudUpload,
} from "lucide-react";

interface InventoryViewProps {
  products: AdminProduct[];
  onAddProduct: (product: Omit<AdminProduct, "id">) => void;
  onUpdateProduct: (id: string, product: Partial<AdminProduct>) => void;
  onDeleteProduct: (id: string) => void;
  onUpdateStock: (id: string, newStock: number) => void;
}

const CATEGORY_DEFAULT_IMAGES: Record<string, string> = {
  vegetables: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&auto=format&fit=crop&q=80",
  fruits: "https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=600&auto=format&fit=crop&q=80",
  dairy: "https://images.unsplash.com/photo-1563636619-e9143da7973b?w=600&auto=format&fit=crop&q=80",
  munchies: "https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=600&auto=format&fit=crop&q=80",
  drinks: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=600&auto=format&fit=crop&q=80",
  bakery: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&auto=format&fit=crop&q=80",
  instant: "https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=600&auto=format&fit=crop&q=80",
};

export default function InventoryView({
  products,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onUpdateStock,
}: InventoryViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<"products" | "categories">("products");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("all");

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);

  // Bulk Upload State
  const [parsedBulkProducts, setParsedBulkProducts] = useState<Omit<AdminProduct, "id">[]>([]);
  const [bulkFileName, setBulkFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const productImageInputRef = useRef<HTMLInputElement>(null);

  // Image Uploading State (Cloudinary)
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(null);

  // Category Manager State
  const [categoriesList, setCategoriesList] = useState<Category[]>(CATEGORIES);
  const [newCatName, setNewCatName] = useState("");

  // Single Product Form State (imageUrl is now OPTIONAL!)
  const [form, setForm] = useState({
    sku: "SKU-SL-" + Math.floor(1000 + Math.random() * 9000),
    name: "",
    brand: "",
    category: "vegetables",
    subcategory: "Daily Veggies",
    costPrice: "25",
    price: "38",
    originalPrice: "50",
    stock: "45",
    weight: "500 g",
    imageUrl: "",
    description: "Farm fresh organic produce harvested today.",
    ratingCount: "0",
  });
  // Additional images for the PDP carousel — max 9 beyond the primary.
  // Held separately from `form` because it's a variable-length list.
  const [extraImages, setExtraImages] = useState<string[]>([]);
  const [isUploadingExtra, setIsUploadingExtra] = useState(false);
  const extraImageInputRef = useRef<HTMLInputElement>(null);

  // Phase C attribute fields — kept in their own state buckets so the
  // main `form` object stays lean. Both blocks default collapsed on the
  // Add flow (so produce SKUs don't stare at empty nutrition tables) and
  // open automatically on the Edit flow if the product already has values.
  const [attrType, setAttrType] = useState("");
  const [attrShelfLife, setAttrShelfLife] = useState("");
  const [attrCountry, setAttrCountry] = useState("India");
  const [attrIngredients, setAttrIngredients] = useState("");
  // Ordered so the admin form matches how the PDP renders (energy → sodium).
  const NUTRITION_KEYS = [
    "servingSize",
    "energy",
    "protein",
    "carbs",
    "sugar",
    "fat",
    "satFat",
    "transFat",
    "sodium",
    "fibre",
  ] as const;
  const NUTRITION_LABELS: Record<string, string> = {
    servingSize: "Serving Size",
    energy: "Energy",
    protein: "Protein",
    carbs: "Carbohydrates",
    sugar: "Total Sugars",
    fat: "Fat",
    satFat: "Saturated Fat",
    transFat: "Trans Fat",
    sodium: "Sodium",
    fibre: "Fibre",
  };
  const NUTRITION_HINTS: Record<string, string> = {
    servingSize: "e.g. 100 g",
    energy: "e.g. 215 kcal",
    protein: "e.g. 4.2 g",
    carbs: "e.g. 32 g",
    sugar: "e.g. 3 g",
    fat: "e.g. 8 g",
    satFat: "e.g. 2 g",
    transFat: "0 g",
    sodium: "e.g. 320 mg",
    fibre: "e.g. 1.5 g",
  };
  const [nutrition, setNutrition] = useState<Record<string, string>>({});
  const [showAttrSection, setShowAttrSection] = useState(false);
  const [showNutritionSection, setShowNutritionSection] = useState(false);

  // Distinct brand values already in the catalog — feeds the brand
  // autocomplete so we don't collect Amul / amul / AMUL variants.
  const brandSuggestions = Array.from(
    new Set(
      products
        .map((p) => (p.brand || "").trim())
        .filter((b) => b.length > 0)
    )
  ).sort();

  // Upload one extra image (carousel slide) — same Cloudinary endpoint as
  // the primary image, but the returned URL is appended to `extraImages`
  // instead of replacing `form.imageUrl`.
  const handleExtraImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (extraImages.length >= 9) {
      alert("Max 9 additional images per product.");
      return;
    }
    setIsUploadingExtra(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok && data.url) {
        setExtraImages((prev) => [...prev, data.url]);
      } else {
        alert(data.message || "Failed to upload additional image.");
      }
    } catch (err) {
      console.error("Cloudinary extra upload error:", err);
      alert("Additional image upload failed. Please try again.");
    } finally {
      setIsUploadingExtra(false);
      // Reset so re-selecting the same file still fires onChange.
      if (extraImageInputRef.current) extraImageInputRef.current.value = "";
    }
  };

  // Upload Product Image to Cloudinary Endpoint
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    setUploadSuccessMsg(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.url) {
        setForm((prev) => ({ ...prev, imageUrl: data.url }));
        setUploadSuccessMsg("Uploaded to Cloudinary!");
        setTimeout(() => setUploadSuccessMsg(null), 3000);
      } else {
        alert(data.message || "Failed to upload image to Cloudinary.");
      }
    } catch (err) {
      console.error("Cloudinary upload error:", err);
      alert("Image upload failed. Please try again.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  // 1-Click Download Excel / CSV Sample Template
  const handleDownloadTemplate = () => {
    const csvHeader = "SKU,Product Title,Category,Subcategory,Cost Price,Selling Price,MRP,Stock Count,Weight Size,Image URL,Description\n";
    const sampleRows =
      'SKU-SL-1001,Organic Farm Fresh Tomatoes,vegetables,Onions & Tomatoes,25,38,50,45,500 g,https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=500&auto=format&fit=crop&q=80,Hand-picked organic red tomatoes\n' +
      'SKU-SL-1002,Amul Taaza Toned Milk,dairy,Milk & Butter,22,28,30,50,500 ml,https://images.unsplash.com/photo-1563636619-e9143da7973b?w=500&auto=format&fit=crop&q=80,Pasteurised toned milk 3.0% fat\n' +
      'SKU-SL-1003,Premium Shimla Apples,fruits,Apples & Bananas,110,149,180,30,4 pcs (~500g),,Crispy juicy Shimla apples\n';

    const blob = new Blob([csvHeader + sampleRows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "satyug_bulk_product_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Parse Uploaded CSV / Excel File
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBulkFileName(file.name);
    const reader = new FileReader();

    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r\n|\n/).filter((l) => l.trim() !== "");
      if (lines.length <= 1) {
        alert("The uploaded file contains no data rows.");
        return;
      }

      const parsed: Omit<AdminProduct, "id">[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
        if (cols.length >= 3 && cols[1]) {
          const cat = (cols[2] || "vegetables").toLowerCase();
          const fallbackImg = CATEGORY_DEFAULT_IMAGES[cat] || "https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&auto=format&fit=crop&q=80";

          parsed.push({
            sku: cols[0] || "SKU-SL-" + Math.floor(1000 + Math.random() * 9000),
            name: cols[1],
            category: cat,
            subcategory: cols[3] || "General",
            costPrice: parseFloat(cols[4]) || 20,
            price: parseFloat(cols[5]) || 35,
            originalPrice: parseFloat(cols[6]) || 45,
            stock: parseInt(cols[7]) || 25,
            weight: cols[8] || "500 g",
            imageUrl: cols[9] || fallbackImg, // Optional image fallback
            description: cols[10] || "",
          });
        }
      }

      setParsedBulkProducts(parsed);
    };

    reader.readAsText(file);
  };

  const handleConfirmBulkImport = () => {
    if (parsedBulkProducts.length === 0) return;
    parsedBulkProducts.forEach((p) => onAddProduct(p));
    alert(`Successfully bulk imported ${parsedBulkProducts.length} product SKUs into inventory!`);
    setIsBulkModalOpen(false);
    setParsedBulkProducts([]);
    setBulkFileName(null);
  };

  // Single Product Handlers
  const getFinalImageUrl = () => {
    if (form.imageUrl.trim()) return form.imageUrl.trim();
    return CATEGORY_DEFAULT_IMAGES[form.category] || "https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&auto=format&fit=crop&q=80";
  };

  // Fold the Phase C attribute state back into what the API expects. Empty
  // strings become nulls; the nutrition map drops empty rows so the PDP
  // doesn't render blank cells.
  const buildAttrPayload = () => {
    const cleanNutrition: Record<string, string> = {};
    for (const [k, v] of Object.entries(nutrition)) {
      if (v && v.trim()) cleanNutrition[k] = v.trim();
    }
    return {
      type: attrType.trim() || null,
      shelfLife: attrShelfLife.trim() || null,
      countryOfOrigin: attrCountry.trim() || null,
      ingredients: attrIngredients.trim() || null,
      nutrition: Object.keys(cleanNutrition).length > 0 ? cleanNutrition : null,
    };
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddProduct({
      sku: form.sku,
      name: form.name.trim(),
      brand: form.brand.trim() || null,
      category: form.category,
      subcategory: form.subcategory,
      costPrice: parseFloat(form.costPrice) || 0,
      price: parseFloat(form.price) || 0,
      originalPrice: parseFloat(form.originalPrice) || 0,
      stock: parseInt(form.stock) || 0,
      weight: form.weight.trim(),
      imageUrl: getFinalImageUrl(),
      images: extraImages.slice(),
      description: form.description.trim(),
      ratingCount: parseInt(form.ratingCount) || 0,
      ...buildAttrPayload(),
    });

    setIsAddModalOpen(false);
    resetForm();
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    onUpdateProduct(editingProduct.id, {
      sku: form.sku,
      name: form.name.trim(),
      brand: form.brand.trim() || null,
      category: form.category,
      subcategory: form.subcategory,
      costPrice: parseFloat(form.costPrice) || 0,
      price: parseFloat(form.price) || 0,
      originalPrice: parseFloat(form.originalPrice) || 0,
      stock: parseInt(form.stock) || 0,
      weight: form.weight.trim(),
      imageUrl: getFinalImageUrl(),
      images: extraImages.slice(),
      description: form.description.trim(),
      ratingCount: parseInt(form.ratingCount) || 0,
      ...buildAttrPayload(),
    });

    setEditingProduct(null);
    resetForm();
  };

  const openEditModal = (p: AdminProduct) => {
    setEditingProduct(p);
    setForm({
      sku: p.sku || "SKU-SL-" + Math.floor(1000 + Math.random() * 9000),
      name: p.name,
      brand: p.brand ?? "",
      category: p.category,
      subcategory: p.subcategory || "Daily Items",
      costPrice: (p.costPrice || Math.round(p.price * 0.7)).toString(),
      price: p.price.toString(),
      originalPrice: (p.originalPrice || Math.round(p.price * 1.25)).toString(),
      stock: p.stock.toString(),
      weight: p.weight,
      imageUrl: p.imageUrl || "",
      description: p.description || "",
      ratingCount: (p.ratingCount ?? 0).toString(),
    });
    setExtraImages(p.images ?? []);
    setAttrType(p.type ?? "");
    setAttrShelfLife(p.shelfLife ?? "");
    setAttrCountry(p.countryOfOrigin ?? "India");
    setAttrIngredients(p.ingredients ?? "");
    setNutrition(p.nutrition ?? {});
    // Auto-open the collapsible when the product already has values so the
    // admin isn't hunting for their own data.
    setShowAttrSection(
      Boolean(p.type || p.shelfLife || (p.countryOfOrigin && p.countryOfOrigin !== "India"))
    );
    setShowNutritionSection(
      Boolean(p.ingredients || (p.nutrition && Object.keys(p.nutrition).length > 0))
    );
  };

  const resetForm = () => {
    setForm({
      sku: "SKU-SL-" + Math.floor(1000 + Math.random() * 9000),
      name: "",
      brand: "",
      category: "vegetables",
      subcategory: "Daily Veggies",
      costPrice: "25",
      price: "38",
      originalPrice: "50",
      stock: "45",
      weight: "500 g",
      imageUrl: "", // Empty default -> Image is optional!
      description: "",
      ratingCount: "0",
    });
    setExtraImages([]);
    setAttrType("");
    setAttrShelfLife("");
    setAttrCountry("India");
    setAttrIngredients("");
    setNutrition({});
    setShowAttrSection(false);
    setShowNutritionSection(false);
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    const created: Category = {
      id: newCatName.toLowerCase().replace(/\s+/g, "_"),
      name: newCatName.trim(),
      icon: "📦",
      count: 0,
      subcategories: ["General"],
    };
    setCategoriesList([...categoriesList, created]);
    setNewCatName("");
  };

  const handleDeleteCategory = (id: string) => {
    setCategoriesList(categoriesList.filter((c) => c.id !== id));
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCat =
      selectedCategoryFilter === "all" || p.category === selectedCategoryFilter;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-100">
            Catalog & Inventory Master
          </h2>
          <p className="text-xs text-slate-400">
            Bulk Excel Listing, Cloudinary Image Uploads, SKU Master, Cost vs MRP Pricing, Category CRUD, and Live Stock Control
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsBulkModalOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-950/60 px-3.5 py-2.5 text-xs font-bold text-emerald-400 hover:bg-emerald-900/60 shadow-sm cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
            Bulk Excel Listing
          </button>

          <button
            onClick={() => setActiveSubTab(activeSubTab === "products" ? "categories" : "products")}
            className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-800 cursor-pointer"
          >
            <Layers className="h-4 w-4 text-purple-400" />
            {activeSubTab === "products" ? "Manage Categories" : "View Products List"}
          </button>

          <button
            onClick={() => {
              resetForm();
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 shadow-md shadow-emerald-500/20 cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Add Product SKU
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: PRODUCT MASTER & LIVE STOCK TABLE */}
      {activeSubTab === "products" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search product title or SKU code..."
                className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-9 pr-4 text-xs font-medium text-slate-200 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs font-bold text-slate-300 focus:border-emerald-500 focus:outline-none"
            >
              <option value="all">All Categories ({products.length})</option>
              {categoriesList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Product Master Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-950 text-[11px] font-bold uppercase text-slate-400">
                <tr>
                  <th className="py-3.5 px-4">SKU / Item</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4 text-right">Cost Price</th>
                  <th className="py-3.5 px-4 text-right">Selling Price</th>
                  <th className="py-3.5 px-4 text-right">MRP</th>
                  <th className="py-3.5 px-4 text-center">Live Stock</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-slate-300">
                {filteredProducts.map((p) => {
                  const isLow = p.stock > 0 && p.stock <= 10;
                  const isOut = p.stock <= 0;
                  const cost = p.costPrice || Math.round(p.price * 0.7);
                  const mrp = p.originalPrice || Math.round(p.price * 1.25);
                  const img = p.imageUrl || CATEGORY_DEFAULT_IMAGES[p.category] || "https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&auto=format&fit=crop&q=80";

                  return (
                    <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-white flex items-center gap-3">
                        <div className="relative h-10 w-10 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 flex-shrink-0">
                          <Image
                            src={img}
                            alt={p.name}
                            fill
                            unoptimized
                            className="object-cover"
                          />
                        </div>
                        <div>
                          <p className="line-clamp-1">{p.name}</p>
                          <span className="font-mono text-[10px] text-emerald-400 font-bold">
                            {p.sku || "SKU-SL-" + p.id.toUpperCase()} • {p.weight}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 uppercase font-bold text-[11px] text-slate-400">
                        {p.category}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-400">₹{cost}</td>
                      <td className="py-3 px-4 text-right font-mono font-black text-white">
                        ₹{p.price}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-400 line-through">
                        ₹{mrp}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <input
                            type="number"
                            value={p.stock}
                            onChange={(e) =>
                              onUpdateStock(p.id, parseInt(e.target.value) || 0)
                            }
                            className={`w-16 rounded-lg border bg-slate-950 px-2 py-1 text-center font-mono font-bold text-xs focus:outline-none ${
                              isOut
                                ? "border-rose-600 text-rose-400"
                                : isLow
                                ? "border-amber-500 text-amber-400"
                                : "border-slate-800 text-emerald-400"
                            }`}
                          />
                          {isOut && (
                            <span className="rounded-full bg-rose-950 px-2 py-0.5 text-[9px] font-black text-rose-400 border border-rose-800">
                              OUT OF STOCK
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(p)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete product ${p.name}?`)) onDeleteProduct(p.id);
                            }}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-950 hover:text-rose-400 cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: CATEGORY MANAGEMENT */}
      {activeSubTab === "categories" && (
        <div className="space-y-4">
          <form onSubmit={handleAddCategory} className="flex gap-2 max-w-md">
            <input
              type="text"
              required
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="Enter new Category Name..."
              className="flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-purple-500 cursor-pointer"
            >
              Add Category
            </button>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {categoriesList.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-2 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{c.icon}</span>
                  <div>
                    <h4 className="text-sm font-extrabold text-white">{c.name}</h4>
                    <p className="text-[11px] text-slate-400">
                      Subcategories: {c.subcategories?.join(", ") || "General"}
                    </p>
                  </div>
                </div>
                {categoriesList.length > 1 && (
                  <button
                    onClick={() => handleDeleteCategory(c.id)}
                    className="rounded-lg p-1.5 text-slate-500 hover:text-rose-400 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BULK EXCEL UPLOAD MODAL */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => setIsBulkModalOpen(false)}
          />

          <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 p-6 text-white shadow-2xl animate-in zoom-in-95 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    Bulk Product SKU Import (Excel / CSV)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Upload multiple product SKUs simultaneously using spreadsheet template
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsBulkModalOpen(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Download className="h-4 w-4 text-emerald-400" />
                  <h4 className="text-xs font-extrabold text-white">
                    1. Download Sample Template
                  </h4>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Download sample CSV template with columns for SKU, Title, Category, Prices, and Stock. Image column is optional!
                </p>
                <button
                  onClick={handleDownloadTemplate}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-800 py-2.5 text-xs font-bold text-emerald-400 hover:bg-slate-700 transition-all border border-emerald-500/30 cursor-pointer"
                >
                  <Download className="h-4 w-4" /> Download Sample CSV Template
                </button>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Upload className="h-4 w-4 text-purple-400" />
                  <h4 className="text-xs font-extrabold text-white">
                    2. Upload Completed Sheet
                  </h4>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Select your completed `.csv` or `.xlsx` file to parse and preview products.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-purple-600/20 py-2.5 text-xs font-bold text-purple-300 hover:bg-purple-600/30 transition-all border border-purple-500/40 cursor-pointer"
                >
                  <Upload className="h-4 w-4" /> Choose Excel/CSV File
                </button>
              </div>
            </div>

            {bulkFileName && (
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 bg-emerald-950/60 p-3 rounded-xl border border-emerald-800">
                <FileText className="h-4 w-4 text-emerald-400" />
                <span>Uploaded File: {bulkFileName} ({parsedBulkProducts.length} items parsed)</span>
              </div>
            )}

            {parsedBulkProducts.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Bulk Preview ({parsedBulkProducts.length} SKUs Ready to Import)
                </h4>
                <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-800 text-[10px] uppercase font-bold text-slate-500">
                      <tr>
                        <th className="p-2">SKU</th>
                        <th className="p-2">Title</th>
                        <th className="p-2">Category</th>
                        <th className="p-2 text-right">Selling Price</th>
                        <th className="p-2 text-center">Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {parsedBulkProducts.map((p, idx) => (
                        <tr key={idx}>
                          <td className="p-2 font-mono text-emerald-400 font-bold">{p.sku}</td>
                          <td className="p-2 font-bold text-white">{p.name}</td>
                          <td className="p-2 uppercase font-semibold text-slate-400">{p.category}</td>
                          <td className="p-2 text-right font-black text-white">₹{p.price}</td>
                          <td className="p-2 text-center font-bold text-emerald-400">{p.stock}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button
                  onClick={handleConfirmBulkImport}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 shadow-md cursor-pointer"
                >
                  <CheckCircle2 className="h-4 w-4" /> Confirm & Import {parsedBulkProducts.length} Products
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ADD / EDIT SINGLE PRODUCT MODAL (IMAGE IS OPTIONAL + CLOUDINARY UPLOAD BUTTON) */}
      {(isAddModalOpen || editingProduct) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => {
              setIsAddModalOpen(false);
              setEditingProduct(null);
            }}
          />

          <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 p-6 text-white shadow-2xl animate-in zoom-in-95 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-extrabold text-white">
                {editingProduct ? "Edit Product Master SKU" : "Add New Product SKU"}
              </h3>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingProduct(null);
                }}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={editingProduct ? handleEditSubmit : handleAddSubmit}
              className="space-y-3.5 text-xs"
            >
              <div>
                <label className="block text-slate-300 font-bold mb-1">SKU Code *</label>
                <input
                  type="text"
                  required
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 font-mono font-bold text-emerald-400 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Product Title *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Organic Farm Fresh Tomatoes"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Brand + Review count row — brand feeds the PDP "Explore all
                  from Brand X" pill; review count feeds the card "(N)" chip
                  Blinkit shows next to the rating. Both are optional. */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    Brand <span className="text-[10px] text-slate-500 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    list="brand-suggestions"
                    value={form.brand}
                    onChange={(e) => setForm({ ...form, brand: e.target.value })}
                    placeholder="e.g. Amul, Britannia"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-white focus:border-emerald-500 focus:outline-none"
                  />
                  {/* Datalist feeds off existing brand values so admins pick
                      an existing spelling instead of creating variants. */}
                  <datalist id="brand-suggestions">
                    {brandSuggestions.map((b) => (
                      <option key={b} value={b} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    Review count <span className="text-[10px] text-slate-500 font-normal">(optional)</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.ratingCount}
                    onChange={(e) => setForm({ ...form, ratingCount: e.target.value })}
                    placeholder="e.g. 1250"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-white focus:border-emerald-500 focus:outline-none"
                  >
                    {categoriesList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Unit Weight *</label>
                  <input
                    type="text"
                    required
                    value={form.weight}
                    onChange={(e) => setForm({ ...form, weight: e.target.value })}
                    placeholder="e.g. 500 g"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Cost Price (₹)</label>
                  <input
                    type="number"
                    required
                    value={form.costPrice}
                    onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Selling Price (₹)</label>
                  <input
                    type="number"
                    required
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">MRP (₹)</label>
                  <input
                    type="number"
                    required
                    value={form.originalPrice}
                    onChange={(e) => setForm({ ...form, originalPrice: e.target.value })}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Initial Stock Count *</label>
                <input
                  type="number"
                  required
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* IMAGE SELECTION (OPTIONAL FIELD + CLOUDINARY UPLOAD BUTTON) */}
              <div className="space-y-2 rounded-2xl bg-slate-950 p-3.5 border border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="block text-slate-300 font-bold flex items-center gap-1.5">
                    <ImageIcon className="h-4 w-4 text-emerald-400" />
                    Product Image <span className="text-[10px] text-slate-400 font-normal">(Optional)</span>
                  </label>
                  {uploadSuccessMsg && (
                    <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> {uploadSuccessMsg}
                    </span>
                  )}
                </div>

                {/* Direct Image File Picker -> Upload to Cloudinary dtyem72cg */}
                <input
                  ref={productImageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="hidden"
                />

                <div className="flex gap-2">
                  <input
                    type="url"
                    value={form.imageUrl}
                    onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                    placeholder="Optional image URL (or upload image below)..."
                    className="flex-1 rounded-xl border border-slate-800 bg-slate-900 p-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />

                  <button
                    type="button"
                    disabled={isUploadingImage}
                    onClick={() => productImageInputRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 px-3 py-2.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500/30 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isUploadingImage ? (
                      <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                    ) : (
                      <CloudUpload className="h-4 w-4 text-emerald-400" />
                    )}
                    <span>{isUploadingImage ? "Uploading..." : "Upload File"}</span>
                  </button>
                </div>

                {/* Image Preview / Default Fallback Indicator */}
                <div className="flex items-center gap-3 pt-1">
                  <div className="relative h-12 w-12 rounded-xl overflow-hidden border border-slate-800 bg-slate-900 flex-shrink-0">
                    <Image
                      src={getFinalImageUrl()}
                      alt="Preview"
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    {form.imageUrl.trim() ? (
                      <span className="text-emerald-400 font-semibold">Custom Image set!</span>
                    ) : (
                      <span>No image uploaded. Auto-assigning default <strong>{form.category}</strong> image on save!</span>
                    )}
                  </p>
                </div>
              </div>

              {/* ADDITIONAL PDP CAROUSEL IMAGES — up to 9 extras beyond the
                  primary. Feeds Product.images which the customer-facing
                  ProductDetailModal renders as a swipeable carousel. */}
              <div className="space-y-2 rounded-2xl bg-slate-950 p-3.5 border border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="block text-slate-300 font-bold flex items-center gap-1.5">
                    <ImageIcon className="h-4 w-4 text-purple-400" />
                    Additional images
                    <span className="text-[10px] text-slate-400 font-normal">
                      (max 9 · appear in the PDP carousel after the primary)
                    </span>
                  </label>
                  <span className="text-[10px] font-semibold text-slate-500">
                    {extraImages.length}/9
                  </span>
                </div>

                <input
                  ref={extraImageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleExtraImageChange}
                  className="hidden"
                />

                <div className="flex flex-wrap gap-2">
                  {extraImages.map((url, i) => (
                    <div
                      key={`${url}-${i}`}
                      className="relative h-14 w-14 overflow-hidden rounded-xl border border-slate-800 bg-slate-900 flex-shrink-0 group"
                    >
                      <Image
                        src={url}
                        alt={`Extra ${i + 1}`}
                        fill
                        unoptimized
                        className="object-cover"
                      />
                      {/* Remove — visible on hover; also always tappable on
                          touch since group-hover doesn't fire without a mouse. */}
                      <button
                        type="button"
                        onClick={() =>
                          setExtraImages((prev) => prev.filter((_, idx) => idx !== i))
                        }
                        className="absolute inset-x-0 bottom-0 bg-slate-950/80 text-[10px] font-bold text-rose-300 hover:text-rose-100 py-0.5 cursor-pointer"
                        aria-label={`Remove additional image ${i + 1}`}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {extraImages.length < 9 && (
                    <button
                      type="button"
                      disabled={isUploadingExtra}
                      onClick={() => extraImageInputRef.current?.click()}
                      className="flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-900 text-purple-300 hover:border-purple-500 hover:text-purple-200 disabled:opacity-50 cursor-pointer"
                      title="Upload another image"
                    >
                      {isUploadingExtra ? (
                        <Loader2 className="h-4 w-4 animate-spin text-purple-300" />
                      ) : (
                        <Plus className="h-4 w-4 text-purple-300" />
                      )}
                    </button>
                  )}
                </div>
                {extraImages.length === 0 && (
                  <p className="text-[11px] text-slate-500 leading-snug">
                    No extra images yet. The PDP shows the primary image alone —
                    add pack-back, ingredients panel, or lifestyle shots for a
                    Blinkit-style carousel.
                  </p>
                )}
              </div>

              {/* PHASE C: PRODUCT DETAILS — Blinkit-parity Key Features
                  chips block on the PDP. All three fields are optional
                  and hidden by default for produce SKUs. */}
              <div className="rounded-2xl bg-slate-950 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAttrSection((v) => !v)}
                  className="w-full flex items-center justify-between px-3.5 py-3 text-xs font-black text-slate-300 hover:bg-slate-900 rounded-2xl cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-purple-400" />
                    Product Details
                    <span className="text-[10px] text-slate-500 font-normal">
                      Type · Shelf Life · Country of Origin
                    </span>
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {showAttrSection ? "Hide" : "Show"}
                  </span>
                </button>
                {showAttrSection && (
                  <div className="space-y-2.5 px-3.5 pb-3.5 border-t border-slate-800 pt-3">
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">
                        Type <span className="text-[10px] text-slate-500 font-normal">(e.g. Namkeen &amp; Mixtures)</span>
                      </label>
                      <input
                        type="text"
                        value={attrType}
                        onChange={(e) => setAttrType(e.target.value)}
                        placeholder="Namkeen & Mixtures / Body Wash / Cold Brew Coffee"
                        className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-white focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-slate-300 font-bold mb-1">
                          Shelf Life
                        </label>
                        <input
                          type="text"
                          value={attrShelfLife}
                          onChange={(e) => setAttrShelfLife(e.target.value)}
                          placeholder="e.g. 180 days"
                          className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-white focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 font-bold mb-1">
                          Country of Origin
                        </label>
                        <input
                          type="text"
                          value={attrCountry}
                          onChange={(e) => setAttrCountry(e.target.value)}
                          placeholder="India"
                          className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-white focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* PHASE C: INGREDIENTS & NUTRITION — free-text ingredients
                  paragraph plus a structured table of per-serving nutrition
                  values. Rows admin leaves blank simply don't appear on
                  the PDP, so this doubles as the API-shape encoder. */}
              <div className="rounded-2xl bg-slate-950 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNutritionSection((v) => !v)}
                  className="w-full flex items-center justify-between px-3.5 py-3 text-xs font-black text-slate-300 hover:bg-slate-900 rounded-2xl cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-amber-400" />
                    Ingredients &amp; Nutrition
                    <span className="text-[10px] text-slate-500 font-normal">
                      Packaged FMCG only
                    </span>
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {showNutritionSection ? "Hide" : "Show"}
                  </span>
                </button>
                {showNutritionSection && (
                  <div className="space-y-3 px-3.5 pb-3.5 border-t border-slate-800 pt-3">
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">
                        Ingredients
                      </label>
                      <textarea
                        rows={3}
                        value={attrIngredients}
                        onChange={(e) => setAttrIngredients(e.target.value)}
                        maxLength={4000}
                        placeholder="Paste the ingredient list from the pack — one paragraph is fine."
                        className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-white focus:border-emerald-500 focus:outline-none resize-none"
                      />
                      <p className="text-[10px] text-slate-500 mt-0.5 text-right">
                        {attrIngredients.length}/4000
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-300 font-bold mb-1.5">
                        Nutritional information
                        <span className="text-[10px] text-slate-500 font-normal ml-1">
                          (leave blank to hide a row)
                        </span>
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {NUTRITION_KEYS.map((k) => (
                          <div key={k}>
                            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                              {NUTRITION_LABELS[k]}
                            </label>
                            <input
                              type="text"
                              value={nutrition[k] ?? ""}
                              onChange={(e) =>
                                setNutrition((prev) => ({ ...prev, [k]: e.target.value }))
                              }
                              placeholder={NUTRITION_HINTS[k]}
                              className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-white focus:border-emerald-500 focus:outline-none"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingProduct(null);
                  }}
                  className="flex-1 rounded-xl border border-slate-800 bg-slate-950 py-2.5 font-bold text-slate-400 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-emerald-500 py-2.5 font-extrabold text-slate-950 hover:bg-emerald-400 shadow-md cursor-pointer"
                >
                  {editingProduct ? "Save Changes" : "Save Product SKU"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
