import { NextResponse } from "next/server";

/**
 * HMAC-SHA256 JWT signing/verification using Web Crypto.
 * Works in BOTH Node runtime (API routes) and Edge runtime (proxy.ts),
 * so we don't need `jsonwebtoken` or `jose`.
 */

const DEV_FALLBACK_SECRET = "satyug_dev_only_secret_do_not_use_in_prod";
const RAW_SECRET = process.env.JWT_SECRET || DEV_FALLBACK_SECRET;

// Production must not boot with the dev fallback secret. Also enforce a
// minimum length — a short HMAC key is trivially brute-forceable and
// makes every JWT in the fleet forge-able. This runs at module load so
// any code path that touches auth crashes the invocation loudly instead
// of quietly issuing tokens anyone can sign.
if (process.env.NODE_ENV === "production") {
  if (RAW_SECRET === DEV_FALLBACK_SECRET) {
    throw new Error(
      "SECURITY: JWT_SECRET env var is not set in production. Refusing to run."
    );
  }
  if (RAW_SECRET.length < 32) {
    throw new Error(
      `SECURITY: JWT_SECRET is only ${RAW_SECRET.length} chars. Use at least 32 (openssl rand -base64 48).`
    );
  }
}

const JWT_SECRET = RAW_SECRET;

export const AUTH_COOKIE_NAME = "satyug_auth_token";

export interface JwtPayload {
  userId: string;
  phone?: string;
  email?: string;
  name: string;
  role: "customer" | "admin";
  // Stamped at sign time from Customer/Admin.tokenVersion. Bumping the DB
  // column invalidates every JWT issued before the bump — see requireAuth
  // in lib/api.ts for the check.
  tokenVersion?: number;
  iat?: number;
  exp?: number;
}

// ─── base64url helpers ─────────────────────────────────────────
function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function fromBase64Url(str: string): Bytes {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes as Bytes;
}

// TS 5.7 tightened Uint8Array typing (Uint8Array<ArrayBufferLike>). Web Crypto
// wants a BufferSource whose backing buffer is ArrayBuffer. Casting via
// `as BufferSource` is safe here — the underlying bytes are always fresh
// ArrayBuffer-backed since we make them with TextEncoder.
// TS 5.7 tightened Uint8Array<ArrayBufferLike> — Web Crypto still accepts
// this at runtime; casting keeps the compiler happy.
type Bytes = Uint8Array & { buffer: ArrayBuffer };
function encodeUtf8(str: string): Bytes {
  return new TextEncoder().encode(str) as Bytes;
}
function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

// ─── HMAC ──────────────────────────────────────────────────────
async function importKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encodeUtf8(JWT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

// Constant-time compare of two base64url strings
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ─── Public API ────────────────────────────────────────────────
export async function signJwtToken(
  payload: Omit<JwtPayload, "iat" | "exp">,
  expiresInDays = 7
): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JwtPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInDays * 24 * 60 * 60,
  };

  const encodedHeader = toBase64Url(encodeUtf8(JSON.stringify(header)));
  const encodedPayload = toBase64Url(encodeUtf8(JSON.stringify(fullPayload)));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const key = await importKey();
  const sigBuf = await crypto.subtle.sign("HMAC", key, encodeUtf8(signingInput));
  const signature = toBase64Url(new Uint8Array(sigBuf));

  return `${signingInput}.${signature}`;
}

/**
 * Verify a JWT. Runs synchronously by using async work — callers should await.
 * We keep a sync-friendly overload (`verifyJwtToken`) that is used inside
 * `proxy.ts` for backwards compat: we lazily call this async under the hood
 * via a small blocking pattern is NOT possible in Edge, so proxy.ts should
 * `await` the async verify.
 */
export async function verifyJwtToken(token: string | undefined | null): Promise<JwtPayload | null> {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [encodedHeader, encodedPayload, signature] = parts;
    const signingInput = `${encodedHeader}.${encodedPayload}`;

    const key = await importKey();
    const expectedBuf = await crypto.subtle.sign("HMAC", key, encodeUtf8(signingInput));
    const expected = toBase64Url(new Uint8Array(expectedBuf));

    if (!timingSafeEqual(signature, expected)) return null;

    const payload = JSON.parse(decodeUtf8(fromBase64Url(encodedPayload))) as JwtPayload;
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;

    return payload;
  } catch {
    return null;
  }
}

// ─── Cookie helpers ────────────────────────────────────────────
export function setAuthCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
}

export function clearAuthCookie(response: NextResponse) {
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
}
