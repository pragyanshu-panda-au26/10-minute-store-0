import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, JwtPayload, verifyJwtToken } from "@/lib/auth";
import { ZodError, ZodSchema } from "zod";

/**
 * Universal Mobile (Android / iOS) & Web API Helpers
 * - Accepts Bearer Token in `Authorization` header OR HTTP-only Cookie
 * - Injects CORS headers into all API responses for Android OKHttp / Retrofit / React Native / Flutter compatibility
 * - Uniform JSON envelopes: `{ success: true, ... }` or `{ success: false, message: "..." }`
 */

export type ApiOk<T> = { success: true } & T;
export type ApiErr = { success: false; message: string; details?: unknown };

/**
 * CORS strategy — driven by env vars so ops can change it without a redeploy:
 *   ALLOWED_ORIGINS="https://app.satyug.com,https://admin.satyug.com,capacitor://localhost"
 *
 * For the Android app you have three options; all work with this setup:
 *   1. Send `Origin: capacitor://localhost` (Capacitor/Ionic default) or
 *      `https://localhost` (React Native) and add that value to ALLOWED_ORIGINS.
 *   2. Send no `Origin` header (raw OkHttp / Retrofit) — CORS is a browser
 *      concept and native HTTP clients ignore it entirely. Nothing to configure.
 *   3. Use `Bearer <token>` auth (which the JWT flow returns in the response
 *      body) — no cookies needed, so credentialed CORS isn't a concern.
 *
 * If ALLOWED_ORIGINS is unset, we fall back to reflecting the request Origin.
 * That's fine for dev; set the env var in prod so the response is deterministic.
 */
function corsHeaders(req?: NextRequest): Record<string, string> {
  const allowed = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const origin = req?.headers.get("origin") ?? "";
  const allowOrigin =
    allowed.length === 0
      ? origin || "*"
      : allowed.includes(origin)
        ? origin
        : allowed[0];

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    // Only send credentials if we're not using the wildcard — the browser
    // will refuse `Allow-Credentials: true` with `Allow-Origin: *`.
    ...(allowOrigin !== "*" ? { "Access-Control-Allow-Credentials": "true" } : {}),
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Requested-With, X-Store-Id, X-User-Lat, X-User-Lng",
    "Access-Control-Expose-Headers": "X-Request-Id, X-Store-Id",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

// Back-compat export — kept because some routes may still import it directly.
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Requested-With, X-Store-Id, X-User-Lat, X-User-Lng",
  "Access-Control-Max-Age": "86400",
};

function applyCors(response: NextResponse, req?: NextRequest) {
  const headers = corsHeaders(req);
  for (const [k, v] of Object.entries(headers)) response.headers.set(k, v);
  return response;
}

export function ok<T extends object>(data: T, init?: ResponseInit) {
  const response = NextResponse.json<ApiOk<T>>({ success: true, ...data }, init);
  return applyCors(response);
}

export function fail(message: string, status = 400, details?: unknown) {
  const response = NextResponse.json<ApiErr>(
    { success: false, message, ...(details ? { details } : {}) },
    { status }
  );
  return applyCors(response);
}

/** Preflight OPTIONS handler — export as `OPTIONS` from any route.ts. */
export function handleOptions(req?: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

/**
 * Try to authenticate the request. Returns `null` if unauthenticated.
 * Accepts either the auth cookie or a `Bearer <token>` header (used by Android & iOS apps).
 */
export async function getAuth(req: NextRequest): Promise<JwtPayload | null> {
  const cookieToken = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  const headerToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const token = cookieToken || headerToken;
  return verifyJwtToken(token);
}

/** Return the user payload or a 401 response — use with `if ("json" in x) return x`. */
export async function requireAuth(
  req: NextRequest,
  role?: "customer" | "admin"
): Promise<JwtPayload | NextResponse> {
  const payload = await getAuth(req);
  if (!payload) return fail("Authentication required", 401);
  if (role && payload.role !== role) return fail("Forbidden", 403);
  return payload;
}

/** Parse & validate a JSON body with zod. Returns data or a 400 response. */
export async function parseJson<T>(
  req: NextRequest,
  schema: ZodSchema<T>
): Promise<T | NextResponse> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    return fail("Validation failed", 400, result.error.flatten());
  }
  return result.data;
}

/** Wrap an async handler and turn thrown errors into 500 JSON envelopes with CORS. */
export function handler<Args extends unknown[]>(
  fn: (...args: Args) => Promise<NextResponse>
): (...args: Args) => Promise<NextResponse> {
  return async (...args: Args) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof ZodError) {
        return fail("Validation failed", 400, err.flatten());
      }
      console.error("[API error]", err);
      return fail("Internal server error", 500);
    }
  };
}

/** Generate a short human-facing order number like SL-249301. */
export function generateOrderNumber(): string {
  return "SL-" + Math.floor(100000 + Math.random() * 900000);
}
