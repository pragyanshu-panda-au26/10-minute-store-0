import { NextRequest } from "next/server";
import { fail } from "@/lib/api";

/**
 * Small in-memory sliding-window rate limiter.
 *
 * Correct for a single long-running process. On Vercel serverless each cold
 * instance keeps its own map, so the effective limit is
 *   perKey × liveInstances
 * which is still a hard ceiling and enough to shut down the common abuses
 * (Twilio bill-burn, coupon enumeration, admin brute force).
 *
 * When you graduate off serverless — or want a shared limit — swap the
 * store for Upstash Rate Limit (Redis) and keep the same public shape:
 *   import { Ratelimit } from "@upstash/ratelimit"
 *   import { Redis }     from "@upstash/redis"
 * The `enforceRateLimit` signature does not need to change.
 *
 * Usage inside a route:
 *
 *   const denied = enforceRateLimit(req, { bucket: "send-otp", perMinute: 5, perDay: 20 });
 *   if (denied) return denied;
 *
 * Returns a NextResponse (429) when the caller has exceeded the limit,
 * `null` otherwise. Pass an extra identity fragment via `keyExtra` to
 * dimension a limit by phone / email / userId in addition to the IP.
 */

type BucketState = { windowMs: number; max: number; hits: number[] };
type BucketKey = string; // `${bucket}:${ip}[:${keyExtra}]:${window}`

const store = new Map<BucketKey, BucketState>();

// Occasional janitor — keeps the map from growing unbounded on a
// long-running host. Cheap: one pass every ~1000 hits.
let insertsSinceSweep = 0;
function maybeSweep(now: number) {
  insertsSinceSweep++;
  if (insertsSinceSweep < 1000) return;
  insertsSinceSweep = 0;
  for (const [k, v] of store) {
    if (v.hits.length === 0 || v.hits[v.hits.length - 1] + v.windowMs < now) {
      store.delete(k);
    }
  }
}

/** Pull the caller IP out of the standard reverse-proxy headers. */
export function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return (
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-vercel-forwarded-for") ||
    "unknown"
  );
}

function tick(
  bucket: string,
  identity: string,
  windowMs: number,
  max: number
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  maybeSweep(now);
  const key = `${bucket}:${identity}:${windowMs}`;
  let state = store.get(key);
  if (!state) {
    state = { windowMs, max, hits: [] };
    store.set(key, state);
  }
  // Drop hits older than the window.
  const cutoff = now - windowMs;
  state.hits = state.hits.filter((t) => t > cutoff);
  if (state.hits.length >= max) {
    const oldest = state.hits[0];
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return { ok: false, retryAfterSec };
  }
  state.hits.push(now);
  return { ok: true };
}

interface Limit {
  /** Bucket name — appears in the 429 body so logs can attribute. */
  bucket: string;
  /** Per-caller cap in a sliding 60s window. */
  perMinute?: number;
  /** Per-caller cap in a sliding 60 min window. */
  perHour?: number;
  /** Per-caller cap in a sliding 24 h window. */
  perDay?: number;
  /**
   * Extra identity dimension. Send-otp uses `phone` so different phones
   * from the same IP each get their own window; admin-login uses `email`.
   * Omit to key on IP only.
   */
  keyExtra?: string;
}

/**
 * Apply all supplied windows to the request. Returns a 429 NextResponse
 * if any window is exceeded, else null. Attaches Retry-After and
 * X-RateLimit-Bucket headers on failure.
 */
export function enforceRateLimit(req: NextRequest, limit: Limit) {
  const ip = clientIp(req);
  const identity = limit.keyExtra ? `${ip}:${limit.keyExtra}` : ip;

  const windows: Array<[number, number | undefined]> = [
    [60_000, limit.perMinute],
    [60 * 60_000, limit.perHour],
    [24 * 60 * 60_000, limit.perDay],
  ];

  for (const [windowMs, max] of windows) {
    if (!max) continue;
    const res = tick(limit.bucket, identity, windowMs, max);
    if (!res.ok) {
      const response = fail(
        `Too many requests — try again in ${res.retryAfterSec}s.`,
        429,
        { bucket: limit.bucket, retryAfterSec: res.retryAfterSec }
      );
      response.headers.set("Retry-After", String(res.retryAfterSec));
      response.headers.set("X-RateLimit-Bucket", limit.bucket);
      return response;
    }
  }

  return null;
}
