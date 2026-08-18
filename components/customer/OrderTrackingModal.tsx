"use client";

import { useState, useEffect } from "react";
import { AdminOrder } from "@/lib/adminDummyData";
import {
  X,
  Clock,
  MapPin,
  CheckCircle2,
  PackageCheck,
  Truck,
  Phone,
  Navigation,
  Bell,
} from "lucide-react";

interface OrderTrackingModalProps {
  order: AdminOrder | null;
  onClose: () => void;
}

export default function OrderTrackingModal({
  order,
  onClose,
}: OrderTrackingModalProps) {
  const [activeStep, setActiveStep] = useState(2); // 1 = Placed, 2 = Packing, 3 = Out for Delivery, 4 = Delivered
  const [deliveryProgress, setRiderProgress] = useState(45); // percentage for GPS map simulation
  const [toastMessage, setToastMessage] = useState<string | null>(
    "🛎️ Your order is being prepared — you'll get a call when the owner heads out."
  );

  useEffect(() => {
    if (!order) return;

    if (order.status === "pending") setActiveStep(1);
    else if (order.status === "confirmed") setActiveStep(2);
    else if (order.status === "out_for_delivery") setActiveStep(3);
    else if (order.status === "delivered") setActiveStep(4);

    // Simulate delivery progress on map
    const interval = setInterval(() => {
      setRiderProgress((prev) => (prev >= 95 ? 30 : prev + 5));
    }, 3000);

    return () => clearInterval(interval);
  }, [order]);

  if (!order) return null;

  const steps = [
    { label: "Order Placed", icon: Clock },
    { label: "Packing at Store", icon: PackageCheck },
    { label: "Out for Delivery", icon: Truck },
    { label: "Delivered", icon: CheckCircle2 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md animate-in fade-in"
        onClick={onClose}
      />

      {/* Tracking Modal */}
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl bg-slate-950 text-white shadow-2xl animate-in zoom-in-95 border border-slate-800">
        {/* In-App Push Notification Alert Toast */}
        {toastMessage && (
          <div className="flex items-center justify-between bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-md">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-amber-300 animate-bounce" />
              <span>{toastMessage}</span>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="text-emerald-200 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-5">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-white">
                Live Order Dispatch #{order.id}
              </h3>
              <span className="flex items-center gap-1 rounded-full bg-emerald-950 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-800">
                ● LIVE GPS
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              ETA: <strong className="text-emerald-400">~10 Minutes</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Step 1: Visual Timeline Progress Bar */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Live Order Lifecycle
            </h4>

            <div className="relative flex justify-between items-center">
              <div className="absolute left-0 top-4 h-1 w-full bg-slate-800 -z-0" />
              <div
                className="absolute left-0 top-4 h-1 bg-emerald-500 transition-all duration-500 -z-0"
                style={{
                  width: `${((activeStep - 1) / (steps.length - 1)) * 100}%`,
                }}
              />

              {steps.map((s, idx) => {
                const Icon = s.icon;
                const isDone = idx + 1 <= activeStep;
                const isCurrent = idx + 1 === activeStep;

                return (
                  <div
                    key={s.label}
                    className="relative z-10 flex flex-col items-center"
                  >
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full transition-all ${
                        isDone
                          ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/40 font-bold"
                          : "bg-slate-900 text-slate-500 border border-slate-800"
                      } ${isCurrent ? "ring-4 ring-emerald-500/30 scale-110" : ""}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <span
                      className={`mt-2 text-[10px] font-bold ${
                        isDone ? "text-emerald-400" : "text-slate-500"
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 2: Simulated in-app delivery map */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300">
                Live delivery map
              </span>
              <span className="text-[11px] font-mono text-emerald-400">
                Lat: 20.2961, Lng: 85.8245
              </span>
            </div>

            <div className="relative h-44 w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-4">
              {/* Map Grid Background Pattern */}
              <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />

              {/* Dark Store Marker */}
              <div className="absolute left-6 top-6 z-10 flex items-center gap-1.5 rounded-xl bg-slate-950/90 px-3 py-1.5 border border-slate-800">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                <span className="text-[10px] font-bold text-slate-200">
                  Dark Store #01
                </span>
              </div>

              {/* Destination Marker */}
              <div className="absolute right-6 bottom-6 z-10 flex items-center gap-1.5 rounded-xl bg-slate-950/90 px-3 py-1.5 border border-slate-800">
                <MapPin className="h-3.5 w-3.5 text-rose-500" />
                <span className="text-[10px] font-bold text-slate-200">
                  Your Address
                </span>
              </div>

              {/* Delivery icon moving along the route */}
              <div
                className="absolute top-1/2 -translate-y-1/2 z-20 transition-all duration-1000"
                style={{ left: `${deliveryProgress}%` }}
              >
                <div className="flex flex-col items-center">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/50 animate-pulse font-bold">
                    <Truck className="h-5 w-5" />
                  </div>
                  <span className="mt-1 rounded-md bg-slate-950/90 px-2 py-0.5 text-[9px] font-extrabold text-emerald-400 border border-slate-800">
                    Owner (en route)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Store owner card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 font-black text-lg">
                RK
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">
                  Rajesh Kumar (Express Delivery Partner)
                </h4>
                <p className="text-[11px] text-slate-400">
                  Vehicle: <span className="font-mono text-slate-200">OD-02-B-4920</span>
                </p>
              </div>
            </div>

            <a
              href="tel:+919876500000"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-500"
              title="Call store"
            >
              <Phone className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
