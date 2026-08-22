"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { Menu, LifeBuoy, Loader2, CheckCircle2, Undo2, Phone, User as UserIcon, Clock, Filter } from "lucide-react";

/**
 * Admin support inbox. Reads `/api/support`, lets the owner mark a ticket
 * resolved / re-open, and refreshes every 30 s so a new ticket coming in
 * while the tab is open shows up without a manual reload.
 *
 * Persistence sits in the file-DB until support tickets migrate to Prisma.
 * That means new tickets survive a warm serverless instance but not a cold
 * start — good enough for a v1 inbox, and the migration is a one-liner once
 * the Prisma model lands.
 */

interface Ticket {
  id: string;
  customerId: string | null;
  customerPhone: string | null;
  customerName: string | null;
  message: string;
  status: "open" | "resolved";
  createdAt: string;
}

type Filter = "open" | "resolved" | "all";

function timeAgo(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return iso;
  const secs = Math.max(1, Math.round((now - then) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOpenMobile, setIsOpenMobile] = useState(false);
  const [filter, setFilter] = useState<Filter>("open");
  // Track which row is mid-flight so the button disables and can't double-fire.
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    try {
      // Prisma-backed: pass ?status=open|resolved to filter server-side, or
      // omit to fetch all (client filter still applies for the "all" chip).
      const url = filter === "all" ? "/api/support" : `/api/support?status=${filter}`;
      const res = await fetch(url, { credentials: "include" });
      const data = await res.json();
      if (!data.success) throw new Error(data.message ?? "Fetch failed");
      setTickets(data.tickets ?? []);
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load tickets.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchTickets();
    // Same 30s cadence as the order Kanban — long enough not to spam the API,
    // short enough that a new ticket appears within a minute.
    const t = setInterval(fetchTickets, 30_000);
    return () => clearInterval(t);
  }, [fetchTickets]);

  const setStatus = async (id: string, status: "open" | "resolved") => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/support/${encodeURIComponent(id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message ?? "Update failed");
      // Local optimistic update — API already applied the change.
      setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    } catch (err: any) {
      // Fall back to a full refetch so the UI never diverges from the server.
      await fetchTickets();
      alert(err?.message ?? "Couldn't update the ticket.");
    } finally {
      setBusyId(null);
    }
  };

  const filtered = useMemo(() => {
    return tickets.filter((t) =>
      filter === "all" ? true : t.status === filter
    );
  }, [tickets, filter]);

  const openCount = tickets.filter((t) => t.status === "open").length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <AdminSidebar
        activeTab="support"
        setActiveTab={() => {}}
        pendingOrdersCount={0}
        lowStockCount={0}
        openTicketsCount={openCount}
        isOpenMobile={isOpenMobile}
        setIsOpenMobile={setIsOpenMobile}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-800 bg-slate-950/90 px-5 py-3.5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsOpenMobile(true)}
              className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-400 md:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <LifeBuoy className="h-4 w-4 text-emerald-400" />
              <h1 className="text-base font-black text-white">Support inbox</h1>
              {openCount > 0 && (
                <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-black text-white">
                  {openCount} open
                </span>
              )}
            </div>
          </div>

          {/* Filter chips */}
          <div className="hidden sm:flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900 p-1 text-[11px] font-bold">
            {(["open", "resolved", "all"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg capitalize transition-colors ${
                  filter === f
                    ? "bg-emerald-600 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </header>

        {/* Mobile filter row (the desktop chips are hidden < sm) */}
        <div className="sm:hidden flex items-center gap-2 border-b border-slate-800 bg-slate-950 px-5 py-2 text-[11px] font-bold text-slate-400">
          <Filter className="h-3.5 w-3.5" />
          {(["open", "resolved", "all"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-1 rounded capitalize ${
                filter === f ? "bg-emerald-600 text-white" : "text-slate-400"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <main className="flex-1 p-4 sm:p-6 max-w-4xl w-full mx-auto space-y-3">
          {loading && tickets.length === 0 && (
            <div className="flex items-center justify-center gap-2 py-16 text-slate-500 text-xs">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
              Loading tickets…
            </div>
          )}

          {error && !loading && (
            <div className="rounded-2xl border border-rose-900 bg-rose-950/50 p-4 text-sm text-rose-300">
              {error}
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-10 text-center space-y-2">
              <LifeBuoy className="mx-auto h-8 w-8 text-slate-600" />
              <p className="text-sm font-bold text-slate-300">
                {filter === "open"
                  ? "No open tickets — inbox zero."
                  : filter === "resolved"
                    ? "No resolved tickets yet."
                    : "No tickets on file."}
              </p>
              <p className="text-xs text-slate-500">
                Customers submit tickets from the in-app help page.
              </p>
            </div>
          )}

          {filtered.map((t) => {
            const isOpen = t.status === "open";
            const busy = busyId === t.id;
            return (
              <article
                key={t.id}
                className={`rounded-2xl border p-4 sm:p-5 space-y-3 shadow-sm transition-colors ${
                  isOpen
                    ? "border-slate-800 bg-slate-900/60"
                    : "border-slate-800/60 bg-slate-900/30 opacity-80"
                }`}
              >
                <header className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                        isOpen
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                          : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      }`}
                    >
                      {t.status}
                    </span>
                    <span className="text-[11px] text-slate-500 flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {timeAgo(t.createdAt)}
                    </span>
                    <span className="text-[11px] text-slate-600 font-mono">
                      {t.id}
                    </span>
                  </div>

                  {isOpen ? (
                    <button
                      onClick={() => setStatus(t.id, "resolved")}
                      disabled={busy}
                      className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-black text-white hover:bg-emerald-500 disabled:opacity-60"
                    >
                      {busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                      Mark resolved
                    </button>
                  ) : (
                    <button
                      onClick={() => setStatus(t.id, "open")}
                      disabled={busy}
                      className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-800 disabled:opacity-60"
                    >
                      {busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Undo2 className="h-3.5 w-3.5" />
                      )}
                      Re-open
                    </button>
                  )}
                </header>

                <p className="text-sm leading-relaxed text-slate-200 whitespace-pre-wrap">
                  {t.message}
                </p>

                <footer className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-800 text-[11px] text-slate-400 font-mono">
                  <span className="flex items-center gap-1.5">
                    <UserIcon className="h-3 w-3" />
                    {t.customerName || <em className="text-slate-500">anonymous</em>}
                  </span>
                  {t.customerPhone && (
                    <a
                      href={`tel:${t.customerPhone.replace(/\s/g, "")}`}
                      className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300"
                    >
                      <Phone className="h-3 w-3" />
                      {t.customerPhone}
                    </a>
                  )}
                </footer>
              </article>
            );
          })}
        </main>
      </div>
    </div>
  );
}
