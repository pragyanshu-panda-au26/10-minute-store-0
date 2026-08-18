"use client";

import { useState } from "react";
import { Image as ImageIcon, Plus, Trash2, CheckCircle2 } from "lucide-react";

interface Banner {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  code: string;
  icon: string;
}

const INITIAL_BANNERS: Banner[] = [
  { id: "b1", badge: "Satyug Flash Deal", title: "Fresh Fruits & Organic Veggies", subtitle: "Get UP TO 40% OFF on daily essentials.", code: "SATYUG40", icon: "🍎" },
  { id: "b2", badge: "Express 10-Min Guarantee", title: "Amul Milk, Eggs & Dairy Staples", subtitle: "Fresh morning dairy delivered in 10 mins.", code: "FREESHIP", icon: "🥛" },
  { id: "b3", badge: "Midnight Craving", title: "Cold Drinks & Munchies", subtitle: "Stock up on icy soda cans & chips.", code: "SATYUG50", icon: "🥤" },
];

export default function BannerManagement() {
  const [banners, setBanners] = useState<Banner[]>(INITIAL_BANNERS);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({ badge: "", title: "", subtitle: "", code: "", icon: "⚡" });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const created: Banner = {
      id: "b_" + Date.now(),
      badge: form.badge.trim() || "Promotional Banner",
      title: form.title.trim(),
      subtitle: form.subtitle.trim(),
      code: form.code.trim().toUpperCase() || "SATYUG",
      icon: form.icon || "⚡",
    };
    setBanners([created, ...banners]);
    setForm({ badge: "", title: "", subtitle: "", code: "", icon: "⚡" });
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    setBanners(banners.filter((b) => b.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-100">
            Customer App Banner Carousel Manager
          </h2>
          <p className="text-xs text-slate-400">
            Publish dynamic promotional hero banners displayed on Customer Storefront
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-extrabold text-slate-950 hover:bg-emerald-400"
        >
          <Plus className="h-4 w-4" /> Add Promo Banner
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {banners.map((b) => (
          <div
            key={b.id}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-2 relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/30">
                {b.badge}
              </span>
              <button
                onClick={() => handleDelete(b.id)}
                className="rounded-lg p-1 text-slate-500 hover:text-rose-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <h3 className="text-base font-bold text-white">{b.title}</h3>
            <p className="text-xs text-slate-400">{b.subtitle}</p>
            <p className="text-xs font-mono font-bold text-emerald-400">Promo Code: {b.code}</p>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 text-white shadow-2xl">
            <h3 className="text-base font-bold mb-4">Add Storefront Banner</h3>
            <form onSubmit={handleAdd} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Badge Title *</label>
                <input
                  type="text"
                  required
                  value={form.badge}
                  onChange={(e) => setForm({ ...form, badge: e.target.value })}
                  placeholder="e.g. Flash Deal"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-bold mb-1">Banner Headline *</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Fresh Mangoes & Fruits"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-bold mb-1">Subtitle Description *</label>
                <input
                  type="text"
                  required
                  value={form.subtitle}
                  onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                  placeholder="e.g. Get 20% OFF today"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-bold mb-1">Promo Code</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="e.g. MANGO20"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-white uppercase font-mono font-bold focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 rounded-xl border border-slate-800 bg-slate-950 py-2.5 font-bold text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-emerald-500 py-2.5 font-bold text-slate-950"
                >
                  Publish Banner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
