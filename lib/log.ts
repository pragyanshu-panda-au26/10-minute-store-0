/**
 * Structured logger — one place every server-side log line goes through.
 *
 * Two properties this module guarantees that raw `console.log` doesn't:
 *
 *   1. Every line is JSON — parseable in Vercel logs, Datadog, Loki, etc.
 *   2. Sensitive headers (Authorization, Cookie, and the app-specific auth
 *      cookie by name) are ALWAYS scrubbed before serialization, even if the
 *      caller forgets. This closes the "bearer tokens leaked into APM logs"
 *      concern raised in the security audit.
 *
 * Also captures errors into Sentry if `SENTRY_DSN` is set. The Sentry init
 * happens lazily on the first `error()` call so the SDK isn't parsed at cold
 * start when the env var is absent.
 */

import { AUTH_COOKIE_NAME } from "@/lib/auth";

/* ── Sensitive keys to scrub ─────────────────────────────────── */

const SENSITIVE_HEADER_NAMES = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "x-auth-token",
]);

const SENSITIVE_FIELD_PATTERNS = [
  /^authorization$/i,
  /^cookie$/i,
  /password/i,
  /secret/i,
  /token$/i,
  /apikey/i,
  /api_key/i,
];

const REDACTED = "[REDACTED]";

/** Redact obviously-sensitive values from any object before it's serialized. */
export function scrub<T>(value: T): T {
  if (value == null) return value;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((v) => scrub(v)) as unknown as T;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_HEADER_NAMES.has(k.toLowerCase())) {
      out[k] = REDACTED;
      continue;
    }
    if (SENSITIVE_FIELD_PATTERNS.some((re) => re.test(k))) {
      out[k] = REDACTED;
      continue;
    }
    if (k === AUTH_COOKIE_NAME) {
      out[k] = REDACTED;
      continue;
    }
    out[k] = scrub(v);
  }
  return out as T;
}

/**
 * Redact sensitive strings that might appear in a Bearer or a cookie header,
 * even if they're embedded in a message string. Best-effort.
 */
function scrubString(s: string): string {
  return s
    .replace(/Bearer\s+[\w.-]+/gi, "Bearer [REDACTED]")
    .replace(new RegExp(`${AUTH_COOKIE_NAME}=[^;\\s]+`, "gi"), `${AUTH_COOKIE_NAME}=[REDACTED]`);
}

/* ── Request IDs ─────────────────────────────────────────────── */

/**
 * Extract or generate a request ID for correlation across log lines.
 * Prefers Vercel's `x-vercel-id`, then any client-set `x-request-id`, and
 * falls back to a crypto random id.
 */
export function requestIdFrom(req: Request | { headers: Headers } | null | undefined): string {
  const h = req?.headers;
  if (h) {
    const vercel = h.get("x-vercel-id");
    if (vercel) return vercel;
    const client = h.get("x-request-id");
    if (client) return client.slice(0, 128);
  }
  // Fresh id — 12-char base36 is plenty for a single request lifetime.
  return "req_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/* ── Sentry (optional) ───────────────────────────────────────── */

let sentryLoaded: boolean | null = null;
let sentryCaptureException: ((err: unknown, ctx?: unknown) => void) | null = null;

async function tryInitSentry() {
  if (sentryLoaded !== null) return sentryLoaded;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    sentryLoaded = false;
    return false;
  }
  try {
    // Dynamic import kept opaque to the bundler on two axes:
    //   • `webpackIgnore: true` tells webpack to leave the import call
    //     alone at build time — no module resolution, no warning when the
    //     package isn't installed.
    //   • The specifier is assembled at runtime as a fallback for bundlers
    //     that don't honour the magic comment (turbopack, esbuild, etc.).
    // Together they make Sentry a genuinely optional peer dep: install it
    // and set SENTRY_DSN to opt in; do neither and the build stays clean.
    const specifier = ["@sentry", "nextjs"].join("/");
    const Sentry = await import(/* webpackIgnore: true */ specifier).catch(
      () => null
    );
    if (!Sentry) {
      sentryLoaded = false;
      return false;
    }
    Sentry.init({
      dsn,
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
    });
    sentryCaptureException = (err, ctx) => Sentry.captureException(err, ctx as any);
    sentryLoaded = true;
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[log] Sentry init failed; continuing without it:", err);
    sentryLoaded = false;
    return false;
  }
}

/* ── Public API ──────────────────────────────────────────────── */

type Level = "debug" | "info" | "warn" | "error";

interface LogContext {
  requestId?: string;
  userId?: string;
  route?: string;
  [key: string]: unknown;
}

function emit(level: Level, message: string, ctx: LogContext = {}, err?: unknown) {
  const line: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    msg: scrubString(message),
    ...scrub(ctx),
  };
  if (err) {
    if (err instanceof Error) {
      line.err = { name: err.name, message: scrubString(err.message), stack: err.stack };
    } else if (typeof err === "object") {
      // Plain-object errors (Razorpay's `{ statusCode, error: {...} }`,
      // fetch response bodies, etc.) used to serialize as `"[object Object]"`
      // via `String(err)`, hiding every field we actually needed. Preserve
      // the shape via JSON, falling back to string only if it's circular.
      try {
        line.err = scrub(err);
      } catch {
        line.err = String(err);
      }
    } else {
      line.err = String(err);
    }
  }
  const json = JSON.stringify(line);
  // eslint-disable-next-line no-console
  (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(json);

  if (level === "error" && err) {
    // Fire-and-forget — the init might still be resolving on the first call;
    // Sentry will queue it in that case.
    void tryInitSentry().then((ready) => {
      if (ready && sentryCaptureException) {
        try { sentryCaptureException(err, { extra: scrub(ctx) }); } catch {}
      }
    });
  }
}

export const log = {
  debug: (msg: string, ctx?: LogContext) => emit("debug", msg, ctx),
  info:  (msg: string, ctx?: LogContext) => emit("info",  msg, ctx),
  warn:  (msg: string, ctx?: LogContext, err?: unknown) => emit("warn", msg, ctx, err),
  error: (msg: string, ctx?: LogContext, err?: unknown) => emit("error", msg, ctx, err),
};

/**
 * Preloaded logger for a single request — every call gets the requestId
 * stamped in without the caller repeating it. Use inside handler():
 *
 *   const rlog = requestLogger(req);
 *   rlog.info("hi");
 */
export function requestLogger(req: Request | { headers: Headers }) {
  const requestId = requestIdFrom(req);
  return {
    requestId,
    debug: (msg: string, ctx?: LogContext) => log.debug(msg, { requestId, ...(ctx ?? {}) }),
    info:  (msg: string, ctx?: LogContext) => log.info (msg, { requestId, ...(ctx ?? {}) }),
    warn:  (msg: string, ctx?: LogContext, err?: unknown) => log.warn (msg, { requestId, ...(ctx ?? {}) }, err),
    error: (msg: string, ctx?: LogContext, err?: unknown) => log.error(msg, { requestId, ...(ctx ?? {}) }, err),
  };
}
