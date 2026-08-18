"use client";

import { useState } from "react";
import { Tag, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { AVAILABLE_PROMOS, PromoCode } from "@/store/useCartStore";

export default function CouponManagement() {
  const [coupons, setCoupons] = useState<PromoCode[]>(AVAILABLE_PROMOS);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [form, setForm] = useState({
    code: "",
    type: "flat" as "flat" | "free_shipping" | "percent",
    value: "",
    minOrder: "",
    description: "",
  });

  const handleCreateCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    const created: PromoCode = {
      code: form.code.trim().toUpperCase(),
      type: form.type,
      value: parseFloat(form.value) || 0,
      minOrder: parseFloat(form.minOrder) || 0,
      description: form.description.trim() || `Discount code ${form.code}`,
    };
    setCoupons([created, ...coupons]);
    setForm({ code: "", type: "flat", value: "", minOrder: "", description: "" });
    setIsModalOpen(false);
  };

  const handleDelete = (code: string) => {
    if (confirm(`Delete coupon code ${code}?`)) {
      setCoupons(coupons.filter((c) => c.code !== code));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-100">
            Coupon & Discount Engine
          </h2>
          <p className="text-xs text-slate-400">
            Create promotional discount codes for Customer App checkout
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-extrabold text-slate-950 hover:bg-emerald-400"
        >
          <Plus className="h-4 w-4" /> Create New Coupon
        </button>
      </div>

      {/* Coupons Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 shadow-xl">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-800 bg-slate-950 text-[11px] font-bold uppercase text-slate-400">
            <tr>
              <th className="py-3.5 px-4">Coupon Code</th>
              <th className="py-3.5 px-4">Discount Type</th>
              <th className="py-3.5 px-4">Discount Value</th>
              <th className="py-3.5 px-4">Min. Order Value</th>
              <th className="py-3.5 px-4">Description</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80 text-slate-300">
            {coupons.map((c) => (
              <tr key={c.code} className="hover:bg-slate-800/40">
                <td className="py-3 px-4 font-mono font-black text-emerald-400 flex items-center gap-2">
                  <Tag className="h-4 w-4 text-emerald-500" />
                  {c.code}
                </td>
                <td className="py-3 px-4 uppercase font-bold text-slate-300">{c.type}</td>
                <td className="py-3 px-4 font-extrabold text-white">
                  {c.type === "percent" ? `${c.value}% OFF` : `₹${c.value} OFF`}
                </td>
                <td className="py-3 px-4 font-semibold text-slate-300">₹{c.minOrder}</td>
                <td className="py-3 px-4 text-slate-400">{c.description}</td>
                <td className="py-3 px-4 text-right">
                  <button
                    onClick={() => handleDelete(c.code)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-950 hover:text-rose-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 text-white shadow-2xl">
            <h3 className="text-base font-bold mb-4">Create Promo Code</h3>
            <form onSubmit={handleCreateCoupon} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Coupon Code *</label>
                <input
                  type="text"
                  required
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="e.g. SATYUG100"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-white uppercase font-mono font-bold focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as any })}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="flat">Flat Amount (₹)</option>
                    <option value="percent">Percentage (%)</option>
                    <option value="free_shipping">Free Shipping</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Discount Value *</label>
                  <input
                    type="number"
                    required
                    value={form.value}
                    onChange={(e) => setForm({ ...form, value: e.target.value })}
                    placeholder="e.g. 50"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Min. Order Requirement (₹) *</label>
                <input
                  type="number"
                  required
                  value={form.minOrder}
                  onChange={(e) => setForm({ ...form, minOrder: e.target.value })}
                  placeholder="e.g. 199"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Description *</label>
                <input
                  type="text"
                  required
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="e.g. Flat ₹50 OFF on orders above ₹199"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-white focus:border-emerald-500 focus:outline-none"
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
                  Publish Coupon
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
