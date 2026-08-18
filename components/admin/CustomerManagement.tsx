"use client";

import { useEffect, useState } from "react";
import { User, Search, Loader2 } from "lucide-react";
import { AdminCustomer } from "@/lib/adminDummyData";

export default function CustomerManagement() {
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (q?: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL("/api/customers", window.location.origin);
      if (q?.trim()) url.searchParams.set("q", q.trim());
      const res = await fetch(url.toString(), { credentials: "include" });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setCustomers(data.customers);
    } catch (err: any) {
      setError(err.message ?? "Failed to load customers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const t = setTimeout(() => load(search), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const toggleBlock = async (c: AdminCustomer) => {
    // optimistic
    setCustomers((prev) => prev.map((x) => (x.id === c.id ? { ...x, isBlocked: !x.isBlocked } : x)));
    try {
      const res = await fetch(`/api/customers/${c.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isBlocked: !c.isBlocked }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
    } catch (err) {
      // revert on failure
      setCustomers((prev) => prev.map((x) => (x.id === c.id ? { ...x, isBlocked: c.isBlocked } : x)));
      alert("Failed to update customer.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-100">
            Customer Directory
          </h2>
          <p className="text-xs text-slate-400">
            Registered customers with order history. Block spam or fraudulent accounts.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, email…"
            className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2 pl-9 pr-4 text-xs font-medium text-slate-200 focus:border-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      {loading && customers.length === 0 && (
        <div className="flex justify-center py-10 text-slate-400 text-xs gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading customers…
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-900 bg-rose-950/50 p-4 text-xs text-rose-300">
          {error}
        </div>
      )}

      {customers.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-950 text-[11px] font-bold uppercase text-slate-400">
                <tr>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Phone</th>
                  <th className="py-3.5 px-4">Orders</th>
                  <th className="py-3.5 px-4">Lifetime</th>
                  <th className="py-3.5 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-slate-300">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-bold text-white">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-800 text-blue-400">
                          <User className="h-4 w-4" />
                        </div>
                        <div>
                          <p>{c.name}</p>
                          <p className="text-[10px] text-slate-500 font-normal">{c.email || "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">{c.phone}</td>
                    <td className="py-3 px-4 font-extrabold text-emerald-400">{c.totalOrders}</td>
                    <td className="py-3 px-4 font-black text-slate-100">₹{c.totalSpent}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => toggleBlock(c)}
                        className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                          c.isBlocked
                            ? "bg-rose-950 text-rose-400 border border-rose-800"
                            : "bg-emerald-950 text-emerald-400 border border-emerald-800"
                        }`}
                      >
                        {c.isBlocked ? "BLOCKED · unblock" : "ACTIVE · block"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
