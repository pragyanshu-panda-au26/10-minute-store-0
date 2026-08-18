"use client";

import { useRef, useState } from "react";
import { useUserStore } from "@/store/useUserStore";
import {
  Phone,
  User as UserIcon,
  KeyRound,
  CheckCircle2,
  ArrowRight,
  X,
  ShieldCheck,
  Zap,
  Loader2,
} from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [step, setStep] = useState<"login" | "otp" | "success">("login");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { applySession } = useUserStore();

  if (!isOpen) return null;

  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Failed to send OTP");
      setMessage({
        tone: "info",
        text: data.devOtp
          ? `OTP sent. (Dev code: ${data.devOtp})`
          : `OTP sent to ${phone}.`,
      });
      setStep("otp");
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err: any) {
      setMessage({ tone: "error", text: err.message || "Failed to send OTP" });
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (idx: number, val: string) => {
    if (val.length > 1) {
      const digits = val.replace(/\D/g, "").slice(0, 6).split("");
      const newOtp = [...otp];
      digits.forEach((d, i) => { if (i < 6) newOtp[i] = d; });
      setOtp(newOtp);
      const nextIdx = Math.min(digits.length, 5);
      inputRefs.current[nextIdx]?.focus();
      return;
    }
    const digit = val.replace(/\D/g, "");
    const newOtp = [...otp];
    newOtp[idx] = digit;
    setOtp(newOtp);
    if (digit && idx < 5) inputRefs.current[idx + 1]?.focus();
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[idx] && idx > 0) inputRefs.current[idx - 1]?.focus();
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const full = otp.join("");
    if (full.length !== 6) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp: full, name: name.trim() || undefined }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Verification failed");
      applySession(data.user);
      setStep("success");
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setMessage({ tone: "error", text: err.message || "Verification failed" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
        onClick={() => !loading && onClose()}
      />

      <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-3xl bg-white p-6 text-slate-900 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-slate-100"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {step === "login" && (
          <form onSubmit={sendOtp} className="space-y-4">
            <div className="text-center">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100">
                <Zap className="h-6 w-6 text-emerald-600" />
              </div>
              <h3 className="text-lg font-black text-slate-900">Sign in</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                We&apos;ll send a 6-digit code to your phone.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                  Mobile number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm font-semibold text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                  Name (optional)
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm font-semibold text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {message && (
              <p
                className={`text-center text-[11px] font-semibold p-2 rounded-xl border ${
                  message.tone === "error"
                    ? "text-rose-700 bg-rose-50 border-rose-100"
                    : "text-emerald-700 bg-emerald-50 border-emerald-100"
                }`}
              >
                {message.text}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !phone.trim()}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-extrabold text-white shadow-md hover:bg-emerald-500 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Get code <ArrowRight className="h-4 w-4" /></>}
            </button>

            <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span>Sessions protected by HTTP-only cookies</span>
            </div>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={verifyOtp} className="space-y-4">
            <div className="text-center">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100">
                <KeyRound className="h-6 w-6 text-emerald-600" />
              </div>
              <h3 className="text-lg font-black text-slate-900">Enter code</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Sent to <strong className="text-slate-900">{phone}</strong>
              </p>
            </div>

            <div className="flex justify-between gap-1.5 py-2">
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => { inputRefs.current[idx] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={digit}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  className="h-12 w-11 rounded-xl border border-slate-300 bg-slate-50 text-center font-mono text-lg font-extrabold text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
                />
              ))}
            </div>

            {message && (
              <p
                className={`text-center text-[11px] font-semibold p-2 rounded-xl border ${
                  message.tone === "error"
                    ? "text-rose-700 bg-rose-50 border-rose-100"
                    : "text-emerald-700 bg-emerald-50 border-emerald-100"
                }`}
              >
                {message.text}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || otp.join("").length !== 6}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-extrabold text-white shadow-md hover:bg-emerald-500 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & sign in"}
            </button>

            <button
              type="button"
              onClick={() => { setStep("login"); setMessage(null); }}
              className="w-full text-center text-xs font-bold text-slate-500 hover:text-slate-800"
            >
              Change phone
            </button>
          </form>
        )}

        {step === "success" && (
          <div className="text-center space-y-4 py-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <h3 className="text-xl font-black text-slate-900">Signed in!</h3>
            <p className="text-xs text-slate-500">You&apos;re all set. Happy shopping.</p>
            <button
              onClick={onClose}
              className="w-full rounded-xl bg-slate-900 py-3 text-sm font-bold text-white hover:bg-slate-800"
            >
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
