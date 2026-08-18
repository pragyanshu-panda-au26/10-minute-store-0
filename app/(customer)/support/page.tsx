"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import MobileBottomNav from "@/components/customer/MobileBottomNav";
import {
  ArrowLeft,
  HelpCircle,
  ChevronDown,
  MessageSquare,
  Send,
  CheckCircle2,
} from "lucide-react";

const FAQS = [
  {
    q: "How does Satyug 10-minute delivery work?",
    a: "We operate hyper-local dark stores equipped with real-time inventory management across Bhubaneswar. Orders are packed within 2 minutes and personally delivered by the store owner.",
  },
  {
    q: "What if an item is physically damaged or missing?",
    a: "You can report the order issue directly using the contact form below or through our support hotline. Instant full refund or replacement is guaranteed under Satyug Fresh Guarantee.",
  },
  {
    q: "How can I apply promo codes and coupons?",
    a: "Enter your coupon code (e.g. SATYUG50, FREESHIP) in the Basket Drawer or Cart Review Page before proceeding to payment.",
  },
  {
    q: "What payment methods are supported?",
    a: "We support UPI (GPay, PhonePe, Paytm), Credit & Debit Cards, NetBanking, and Cash on Delivery (COD).",
  },
];

export default function SupportPage() {
  const router = useRouter();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [issueMsg, setIssueMsg] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setIssueMsg("");
    }, 2500);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-28">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md px-4 py-3">
        <div className="mx-auto max-w-xl flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-emerald-700"
          >
            <ArrowLeft className="h-4 w-4" /> Store
          </button>
          <h1 className="text-base font-black text-slate-900">
            Support & FAQs
          </h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-4 space-y-4">
        {/* FAQs */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 space-y-3 shadow-xs">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <HelpCircle className="h-4 w-4 text-emerald-600" />
            Frequently Asked Questions
          </h2>

          <div className="space-y-2">
            {FAQS.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="flex w-full items-center justify-between p-3.5 text-left text-xs font-bold text-slate-900"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`h-4 w-4 text-slate-400 transition-transform ${
                        isOpen ? "rotate-180 text-emerald-600" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <p className="px-3.5 pb-3.5 text-xs text-slate-600 leading-relaxed border-t border-slate-200/60 pt-2 bg-white">
                      {faq.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Contact Support Ticket */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 space-y-3 shadow-xs">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <MessageSquare className="h-4 w-4 text-emerald-600" />
            Report Order Issue / Support Form
          </h2>

          {submitted ? (
            <div className="flex items-center gap-2 rounded-2xl bg-emerald-100 p-4 text-xs font-bold text-emerald-800">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <span>Support ticket submitted! Our team will call you within 5 mins.</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <textarea
                required
                rows={4}
                value={issueMsg}
                onChange={(e) => setIssueMsg(e.target.value)}
                placeholder="Describe your issue or order inquiry..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-900 focus:border-emerald-500 focus:outline-none"
              />
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3.5 text-xs font-bold text-white shadow-md hover:bg-slate-800"
              >
                <Send className="h-4 w-4" /> Submit Support Ticket
              </button>
            </form>
          )}
        </div>
      </main>

      <MobileBottomNav />
    </div>
  );
}
