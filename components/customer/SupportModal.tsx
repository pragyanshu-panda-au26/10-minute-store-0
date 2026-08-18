"use client";

import { useState } from "react";
import {
  HelpCircle,
  ChevronDown,
  MessageSquare,
  X,
  Send,
  CheckCircle2,
} from "lucide-react";

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

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
    a: "Enter your coupon code (e.g. SATYUG50, FREESHIP) in the Basket Drawer during checkout before proceeding to payment.",
  },
  {
    q: "What payment methods are supported?",
    a: "We support UPI (GPay, PhonePe, Paytm), Credit & Debit Cards, NetBanking, and Cash on Delivery (COD).",
  },
];

export default function SupportModal({ isOpen, onClose }: SupportModalProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [issueMsg, setIssueMsg] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setIssueMsg("");
      onClose();
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md animate-in fade-in"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl bg-white text-slate-900 shadow-2xl animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 font-bold">
              <HelpCircle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                Support & FAQs
              </h3>
              <p className="text-xs text-slate-500">
                Satyug Lifestyle Customer Assistance
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* FAQ Accordion */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Frequently Asked Questions
            </h4>
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

          {/* Contact Issue Submission Form */}
          <div className="space-y-2 border-t border-slate-100 pt-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4 text-emerald-600" />
              Report an Issue / Contact Support
            </h4>

            {submitted ? (
              <div className="flex items-center gap-2 rounded-2xl bg-emerald-100 p-4 text-xs font-bold text-emerald-800 animate-in fade-in">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <span>Ticket submitted! Support team will call you back within 5 minutes.</span>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <textarea
                  required
                  rows={3}
                  value={issueMsg}
                  onChange={(e) => setIssueMsg(e.target.value)}
                  placeholder="Describe your issue or feedback (e.g. Order #SL-948210 item damaged)..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none"
                />
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-xs font-bold text-white shadow-md hover:bg-slate-800"
                >
                  <Send className="h-4 w-4" /> Submit Support Ticket
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
