"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, Mail, Lock, Loader2, AlertCircle } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const redirect = search.get("redirect") || "/admin";
  const [email, setEmail] = useState(process.env.NEXT_PUBLIC_ADMIN_HINT_EMAIL || "");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Login failed");
      router.push(redirect);
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-sm space-y-5 rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl"
    >
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 font-black text-slate-950 text-sm shadow-lg shadow-emerald-500/30">
          10m
        </div>
        <h1 className="text-lg font-black tracking-tight text-white">
          Owner Console
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Sign in with your admin email &amp; password.
        </p>
      </div>

      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
          Email
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@satyug.local"
            className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-9 pr-3 text-sm font-semibold text-white placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
          Password
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-9 pr-3 text-sm font-semibold text-white placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-900/60 bg-rose-950/40 p-3 text-xs font-semibold text-rose-300">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-extrabold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 disabled:opacity-60"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
        Sign in
      </button>

      <p className="text-center text-[10px] text-slate-500 leading-relaxed">
        Access is restricted. All activity is logged. Set a strong password
        via <code className="text-slate-400">ADMIN_SEED_PASSWORD</code> in your <code className="text-slate-400">.env</code>.
      </p>
    </form>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <Suspense fallback={<div className="text-slate-400 text-xs">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
