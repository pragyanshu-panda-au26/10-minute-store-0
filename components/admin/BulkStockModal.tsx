"use client";

import { useMemo, useState } from "react";
import {
  X,
  ClipboardPaste,
  Package,
  Plus,
  Minus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Upload,
} from "lucide-react";

/**
 * Blinkit-style bulk stock update.
 *
 * Two modes:
 *   1. Grid — search a product, tap +N / −N or type an absolute stock level.
 *      Best for the "we received a delivery of 20 crates" workflow.
 *   2. Paste CSV — for stock takes from spreadsheets. Format:
 *        sku,delta                         (positive to add, negative to subtract)
 *        sku,stock=N                       (absolute set)
 *        SKU-P1,25
 *        SKU-P2,stock=100
 *
 * Both submit through /api/products/bulk-stock in ONE call.
 */

interface AdminProductRow {
  id: string;
  sku?: string;
  name: string;
  stock: number;
}

interface BulkStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: AdminProductRow[];
  /** Called after a successful bulk update so parent can refresh its list. */
  onDone?: () => void;
}

interface Row {
  id: string;
  sku?: string;
  name: string;
  currentStock: number;
  /** null = don't change, number = new absolute stock */
  newStock: number | null;
}

export default function BulkStockModal({
  isOpen,
  onClose,
  products,
  onDone,
}: BulkStockModalProps) {
  const [mode, setMode] = useState<"grid" | "paste">("grid");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Record<string, number | null>>({});
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ updated: number; missing: string[]; failed: any[] } | null>(null);

  const filtered = useMemo(
    () => {
      const q = search.trim().toLowerCase();
      if (!q) return products.slice(0, 60);
      return products
        .filter((p) => `${p.sku ?? ""} ${p.name}`.toLowerCase().includes(q))
        .slice(0, 60);
    },
    [products, search]
  );

  const dirtyCount = Object.values(rows).filter((v) => v !== null && v !== undefined).length;

  if (!isOpen) return null;

  const setRow = (id: string, newStock: number | null) =>
    setRows((prev) => ({ ...prev, [id]: newStock }));

  const bump = (p: AdminProductRow, by: number) => {
    const cur = rows[p.id] ?? p.stock;
    setRow(p.id, Math.max(0, cur + by));
  };

  const submitGrid = async () => {
    const items = Object.entries(rows)
      .filter(([_, s]) => s !== null && s !== undefined)
      .map(([id, stock]) => ({ id, stock: stock as number }));
    if (items.length === 0) return;
    await submit(items);
  };

  const submitPaste = async () => {
    // Parse: `sku,delta` or `sku,stock=N`, one per line
    const items: any[] = [];
    for (const line of pasted.split("\n")) {
      const t = line.trim();
      if (!t) continue;
      const [rawSku, rawVal] = t.split(/[,\t]/).map((x) => x?.trim());
      if (!rawSku || !rawVal) continue;
      if (rawVal.toLowerCase().startsWith("stock=")) {
        const n = Number(rawVal.slice(6));
        if (Number.isFinite(n)) items.push({ sku: rawSku, stock: Math.max(0, Math.floor(n)) });
      } else {
        const n = Number(rawVal);
        if (Number.isFinite(n)) items.push({ sku: rawSku, delta: Math.floor(n) });
      }
    }
    if (items.length === 0) {
      alert("Nothing to parse. Example: SKU-P1,25 or SKU-P2,stock=100");
      return;
    }
    await submit(items);
  };

  const submit = async (items: any[]) => {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/products/bulk-stock", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, defaultReason: "restock" }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setResult({ updated: data.updated, missing: data.missing, failed: data.failed });
      onDone?.();
      if (data.updated > 0) setRows({});
    } catch (err: any) {
      alert(err.message ?? "Bulk update failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => !busy && onClose()} />

      <div className="relative z-10 w-full sm:max-w-2xl sm:mx-4 bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-800 text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-emerald-400" />
            <h2 className="text-base font-black">Bulk stock update</h2>
            {dirtyCount > 0 && mode === "grid" && (
              <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-black text-white">
                {dirtyCount} changed
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mode switcher */}
        <div className="flex gap-1 border-b border-slate-800 px-5 pt-3">
          {[
            { key: "grid", label: "Adjust inline", Icon: Package },
            { key: "paste", label: "Paste CSV", Icon: ClipboardPaste },
          ].map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setMode(key as any)}
              className={`flex items-center gap-1.5 rounded-t-xl px-3 py-2 text-xs font-bold ${
                mode === key
                  ? "bg-slate-950 text-emerald-400 border-x border-t border-slate-800"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {mode === "grid" && (
            <>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search product name or SKU…"
                className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2 px-3 text-xs text-white focus:border-emerald-500 focus:outline-none"
              />

              <div className="space-y-1.5">
                {filtered.map((p) => {
                  const newVal = rows[p.id];
                  const effective = newVal ?? p.stock;
                  const changed = newVal != null && newVal !== p.stock;
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${
                        changed
                          ? "border-emerald-500/40 bg-emerald-950/30"
                          : "border-slate-800 bg-slate-950/60"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white line-clamp-1">{p.name}</p>
                        <p className="text-[10px] font-mono text-slate-500">
                          {p.sku ?? p.id} · currently {p.stock}
                        </p>
                      </div>
                      <button
                        onClick={() => bump(p, -1)}
                        className="rounded-lg bg-slate-800 p-1.5 text-slate-300 hover:bg-slate-700"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <input
                        type="number"
                        min={0}
                        value={effective}
                        onChange={(e) => setRow(p.id, Math.max(0, Number(e.target.value) || 0))}
                        className="w-16 rounded-lg border border-slate-800 bg-slate-950 py-1 px-2 text-center text-xs font-black text-white focus:border-emerald-500 focus:outline-none"
                      />
                      <button
                        onClick={() => bump(p, 1)}
                        className="rounded-lg bg-slate-800 p-1.5 text-slate-300 hover:bg-slate-700"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      {changed && (
                        <button
                          onClick={() => setRow(p.id, null)}
                          className="text-[10px] font-bold text-slate-500 hover:text-white"
                        >
                          reset
                        </button>
                      )}
                    </div>
                  );
                })}
                {filtered.length === 0 && (
                  <p className="text-center text-xs text-slate-500 py-8">No matches.</p>
                )}
              </div>
            </>
          )}

          {mode === "paste" && (
            <>
              <p className="text-[11px] text-slate-400">
                One line per SKU. Format: <code>SKU,delta</code> or <code>SKU,stock=N</code>.
                Example:
              </p>
              <pre className="rounded-xl bg-slate-950 border border-slate-800 p-2 text-[11px] text-slate-400 overflow-x-auto">
{`SKU-P1,25          # add 25 to current stock
SKU-P2,-10         # subtract 10
SKU-P3,stock=100   # set absolute stock to 100`}
              </pre>
              <textarea
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                rows={10}
                placeholder="SKU-P1,25"
                className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-white focus:border-emerald-500 focus:outline-none"
              />
            </>
          )}

          {result && (
            <div
              className={`rounded-2xl p-3 text-xs border ${
                result.updated > 0
                  ? "bg-emerald-950/40 border-emerald-800 text-emerald-300"
                  : "bg-amber-950/40 border-amber-800 text-amber-300"
              }`}
            >
              <p className="flex items-center gap-2 font-bold">
                {result.updated > 0 ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                Updated {result.updated}.
                {result.missing.length > 0 && ` ${result.missing.length} SKU(s) not found.`}
                {result.failed.length > 0 && ` ${result.failed.length} failed.`}
              </p>
              {result.missing.length > 0 && (
                <p className="mt-1 text-[11px] font-mono text-slate-400 line-clamp-3">
                  Missing: {result.missing.join(", ")}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 border-t border-slate-800 bg-slate-950 px-5 py-3">
          <button
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded-2xl border border-slate-800 py-3 text-sm font-bold text-slate-300 hover:bg-slate-900 disabled:opacity-60"
          >
            Close
          </button>
          <button
            onClick={mode === "grid" ? submitGrid : submitPaste}
            disabled={busy || (mode === "grid" && dirtyCount === 0) || (mode === "paste" && !pasted.trim())}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 text-sm font-extrabold text-white shadow hover:bg-emerald-500 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {mode === "grid" ? `Update ${dirtyCount || ""}` : "Apply CSV"}
          </button>
        </div>
      </div>
    </div>
  );
}
