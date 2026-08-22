/**
 * Skeletons — small primitive + a handful of ready-shaped variants for the
 * customer surfaces flagged in the UX audit (orders list, checkout summary,
 * address form). Reads more like "the page is coming" than a spinner does,
 * and doesn't shift layout when real content lands.
 *
 * The `prefers-reduced-motion` guard on the shimmer is important — animated
 * placeholders trigger vestibular discomfort for some users.
 */

interface SkeletonProps {
  className?: string;
  /** Circle skeleton for avatar / thumbnail cells. */
  circle?: boolean;
}

export function Skeleton({ className = "", circle = false }: SkeletonProps) {
  return (
    <div
      className={[
        "bg-slate-200/80 dark:bg-slate-800/70",
        circle ? "rounded-full" : "rounded-md",
        "motion-safe:animate-pulse",
        className,
      ].join(" ")}
      aria-hidden="true"
    />
  );
}

/** Orders list — three rows of an order card. */
export function OrdersListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-12 w-12" />
            <Skeleton className="h-12 w-12" />
            <Skeleton className="h-12 w-12" />
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-24 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Checkout summary — the "delivering to" card + bill card + payment tiles. */
export function CheckoutSkeleton() {
  return (
    <div className="space-y-4">
      {/* dark total band */}
      <div className="rounded-2xl bg-slate-950 p-5 text-center space-y-2">
        <Skeleton className="mx-auto h-3 w-24 bg-slate-800" />
        <Skeleton className="mx-auto h-8 w-32 bg-slate-800" />
      </div>
      {/* delivering to */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-full" />
      </div>
      {/* bill card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
        <Skeleton className="h-3 w-20" />
        <div className="flex justify-between"><Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-12" /></div>
        <div className="flex justify-between"><Skeleton className="h-3 w-24" /><Skeleton className="h-3 w-10" /></div>
        <div className="flex justify-between"><Skeleton className="h-3 w-16" /><Skeleton className="h-3 w-10" /></div>
        <div className="flex justify-between pt-2 border-t border-slate-100">
          <Skeleton className="h-4 w-16" /><Skeleton className="h-4 w-16" />
        </div>
      </div>
      {/* payment tiles */}
      <div className="rounded-3xl border border-slate-200 bg-white p-4 space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
      </div>
    </div>
  );
}

/** Address form — the "Use my location" card + inputs stack. */
export function AddressFormSkeleton() {
  return (
    <div className="space-y-4 p-2">
      <Skeleton className="h-14 w-full rounded-xl" />
      <Skeleton className="h-48 w-full rounded-2xl" />
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
