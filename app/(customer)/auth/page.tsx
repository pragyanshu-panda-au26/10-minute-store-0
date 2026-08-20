"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/store/useUserStore";
import MobileBottomNav from "@/components/customer/MobileBottomNav";
import {
  ArrowLeft,
  Phone,
  Mail,
  KeyRound,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Zap,
} from "lucide-react";

export default function AuthPage() {
  const router = useRouter();
  const [step, setStep] = useState<"login" | "otp" | "success">("login");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [serverMsg, setServerMsg] = useState<string | null>(null);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { applySession } = useUserStore();

  // After a successful OTP verify, land the user on the storefront instead of
  // parking them on a "click to continue" screen. Short delay keeps the
  // "authenticated" tick visible long enough to feel intentional.
  useEffect(() => {
    if (step !== "success") return;
    const t = setTimeout(() => router.replace("/"), 700);
    return () => clearTimeout(t);
  }, [step, router]);

  const handleSendTwilioOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setServerMsg(null);

    try {
      const res = await fetch("/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });

      const data = await res.json();
      if (data.success) {
        setServerMsg(data.message);
        setStep("otp");
        setTimeout(() => inputRefs.current[0]?.focus(), 100);
      } else {
        setServerMsg(data.message || "Failed to send Twilio SMS OTP");
      }
    } catch (err: any) {
      // Real network / server failure — surface it to the user instead of
      // pretending the OTP was sent (previous behavior masked the failure and
      // advanced to the OTP step, where nothing the user typed could ever
      // verify).
      setServerMsg(err?.message || "Could not reach OTP service. Check your connection and retry.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (idx: number, val: string) => {
    if (val.length > 1) {
      const digits = val.replace(/\D/g, "").slice(0, 6).split("");
      const newOtp = [...otp];
      digits.forEach((d, i) => {
        if (i < 6) newOtp[i] = d;
      });
      setOtp(newOtp);
      const nextIdx = Math.min(digits.length, 5);
      inputRefs.current[nextIdx]?.focus();
      return;
    }

    const digit = val.replace(/\D/g, "");
    const newOtp = [...otp];
    newOtp[idx] = digit;
    setOtp(newOtp);

    if (digit && idx < 5) {
      inputRefs.current[idx + 1]?.focus();
    }
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  };

  const handleVerifyTwilioOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setServerMsg(null);

    const fullOtpStr = otp.join("");

    try {
      const res = await fetch("/api/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp: fullOtpStr }),
      });

      const data = await res.json();
      if (data.success) {
        applySession(data.user);
        setStep("success");
        // Auto-redirect to the home page after a brief confirmation flash —
        // the "Return to Storefront" button is still there as a fallback if
        // the redirect gets blocked or the user prefers to tap it.
        setTimeout(() => router.push("/"), 900);
      } else {
        setServerMsg(data.message || "Invalid OTP code");
      }
    } catch (err: any) {
      setServerMsg(err?.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-28">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md px-4 py-3">
        <div className="mx-auto max-w-sm flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-emerald-700"
          >
            <ArrowLeft className="h-4 w-4" /> Store
          </button>
          <h1 className="text-base font-black text-slate-900">
            Twilio SMS Sign In
          </h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="mx-auto max-w-sm px-4 py-8 space-y-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs">
          {step === "login" && (
            <form onSubmit={handleSendTwilioOtp} className="space-y-4">
              <div className="text-center">
                <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 font-bold">
                  <Zap className="h-7 w-7 text-blue-600" />
                </div>
                <h2 className="text-xl font-black text-slate-900">
                  Satyug Sign In
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Twilio 6-digit SMS OTP Authentication
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mobile Phone Number *
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 pl-9 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Address (Optional)
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 pl-9 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3.5 text-xs font-extrabold text-white shadow-md hover:bg-blue-500 transition-all disabled:opacity-75"
              >
                {loading ? "Requesting Twilio Gateway..." : "Get Twilio SMS OTP Code"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={handleVerifyTwilioOtp} className="space-y-4 text-center">
              <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                <KeyRound className="h-7 w-7" />
              </div>
              <h2 className="text-xl font-black text-slate-900">Verify Twilio SMS OTP</h2>
              <p className="text-xs text-slate-500">
                Enter 6-digit SMS code sent to <strong>{phone}</strong>
              </p>

              <div className="flex justify-center gap-1.5 py-2">
                {[0, 1, 2, 3, 4, 5].map((idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      inputRefs.current[idx] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={otp[idx]}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    className="h-11 w-11 text-center rounded-xl border border-slate-300 bg-slate-50 text-base font-black text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none shadow-xs"
                  />
                ))}
              </div>

              <button
                type="submit"
                disabled={loading || otp.join("").length < 6}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3.5 text-xs font-extrabold text-white shadow-md hover:bg-blue-500 active:scale-95 transition-all disabled:opacity-50"
              >
                {loading ? "Verifying..." : "Verify & Complete Sign In"}
              </button>
            </form>
          )}

          {step === "success" && (
            <div className="text-center py-6 space-y-3">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h2 className="text-xl font-black text-slate-900">Signed in!</h2>
              <p className="text-xs text-slate-500">
                Redirecting you to the storefront…
              </p>
              {/* Fallback in case the auto-redirect doesn't fire (e.g. the
                  user disabled JS between OTP send and verify). */}
              <button
                onClick={() => router.replace("/")}
                className="w-full rounded-2xl bg-slate-900 py-3 text-xs font-bold text-white hover:bg-slate-800"
              >
                Go now
              </button>
            </div>
          )}

          {serverMsg && (
            <p
              className={`mt-2 text-center text-[11px] font-semibold ${
                /fail|invalid|error|could not|denied|expired/i.test(serverMsg)
                  ? "text-rose-700"
                  : "text-blue-700"
              }`}
            >
              {serverMsg}
            </p>
          )}

          <div className="mt-4 flex items-center justify-center gap-1 text-[10px] text-slate-400 pt-3 border-t border-slate-100">
            <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
            <span>Twilio Verified REST API Authorization Key</span>
          </div>
        </div>
      </main>

      <MobileBottomNav />
    </div>
  );
}
