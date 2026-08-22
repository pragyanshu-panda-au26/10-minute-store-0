"use client";

import { useEffect, useState } from "react";

/**
 * A one-shot confetti burst rendered on canvas — no external library, so
 * we don't ship a 30 kB package for a moment. Fires once when `active`
 * flips true; cleans up its own animation frames on unmount.
 *
 * Called from the checkout confirmation screen. The order-placed moment is
 * what the customer remembers — peak-end rule — so it deserves more than
 * a static green tick. Also fires a subtle haptic on supported devices.
 */

interface OrderPlacedCelebrationProps {
  /** Flip true once when the order is placed; component fires once then idles. */
  active: boolean;
  /** Optional ETA in minutes for the "arrives in ~N min" ring copy. */
  etaMinutes?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rot: number;
  vr: number;
  life: number;
}

const CONFETTI_COLORS = [
  "#10b981", // emerald
  "#f59e0b", // amber
  "#f43f5e", // rose
  "#3b82f6", // blue
  "#a855f7", // purple
];

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

export default function OrderPlacedCelebration({
  active,
  etaMinutes = 10,
}: OrderPlacedCelebrationProps) {
  const reduced = usePrefersReducedMotion();
  const [remaining, setRemaining] = useState(etaMinutes * 60); // seconds
  const [showConfetti, setShowConfetti] = useState(false);

  // Fire confetti + haptic exactly once when active flips true.
  useEffect(() => {
    if (!active || reduced) return;
    setShowConfetti(true);
    // Best-effort haptic — silently no-ops on desktop / non-supporting mobile.
    try {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        (navigator as any).vibrate?.([15, 60, 15]);
      }
    } catch {}
    const t = setTimeout(() => setShowConfetti(false), 3500);
    return () => clearTimeout(t);
  }, [active, reduced]);

  // ETA countdown — one tick per second, stops at zero. Purely cosmetic;
  // real order lifecycle drives the actual tracking page.
  useEffect(() => {
    if (!active) return;
    setRemaining(etaMinutes * 60);
    const t = setInterval(() => {
      setRemaining((r) => (r <= 0 ? 0 : r - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [active, etaMinutes]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <>
      {showConfetti && !reduced && <ConfettiCanvas />}

      {/* ETA countdown ring — the visual anchor customers remember when
          they reopen the app later. Big, live, unmistakably about "when". */}
      {active && (
        <div className="flex flex-col items-center py-2">
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/60 border-4 border-emerald-500 shadow-lg shadow-emerald-500/20">
            <div className="text-center">
              <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 tabular-nums leading-none">
                {mins}:{secs.toString().padStart(2, "0")}
              </p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-700/70 dark:text-emerald-300/70 mt-0.5">
                ETA
              </p>
            </div>
            {/* Animated ring — sweeps once around the counter, then loops
                gently. Skipped entirely under prefers-reduced-motion. */}
            {!reduced && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-[-6px] rounded-full border-4 border-transparent border-t-emerald-400 animate-spin"
                style={{ animationDuration: "3s" }}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* ── Canvas confetti — 60-frame burst, then cleans up ────────── */

function ConfettiCanvas() {
  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.style.position = "fixed";
    canvas.style.inset = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "70";
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    document.body.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const particles: Particle[] = [];
    // Two "cannons" from bottom-left and bottom-right corners aiming inward-up.
    const spawnBatch = (fromLeft: boolean) => {
      const originX = fromLeft ? 0 : window.innerWidth;
      const originY = window.innerHeight;
      for (let i = 0; i < 45; i++) {
        const angle = fromLeft
          ? (Math.random() * 45 + 55) * (Math.PI / 180) // 55°-100° from +X
          : (Math.random() * 45 + 100) * (Math.PI / 180);
        const speed = 12 + Math.random() * 8;
        particles.push({
          x: originX,
          y: originY,
          vx: Math.cos(angle) * speed * (fromLeft ? 1 : -1),
          vy: -Math.sin(angle) * speed,
          size: 6 + Math.random() * 6,
          color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.3,
          life: 1,
        });
      }
    };
    spawnBatch(true);
    spawnBatch(false);

    let frame = 0;
    let raf = 0;
    const step = () => {
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.vy += 0.35; // gravity
        p.vx *= 0.995;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life -= 0.008;
        if (p.life <= 0) continue;
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.5);
        ctx.restore();
      }
      if (frame < 180 && particles.some((p) => p.life > 0)) {
        raf = requestAnimationFrame(step);
      } else {
        canvas.remove();
      }
    };
    raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf);
      canvas.remove();
    };
  }, []);
  return null;
}
