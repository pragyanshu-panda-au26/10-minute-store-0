import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fail, handleOptions, handler, ok, parseJson } from "@/lib/api";

/**
 * Forward geocoding: address-string → lat/lng.
 *
 * Prefers the Google Geocoding API (GOOGLE_MAPS_SERVER_KEY or
 * GOOGLE_MAPS_API_KEY) and falls back to Nominatim so a fresh clone still
 * works. Keeping this behind our own API route (instead of hitting Nominatim
 * from the browser) is important — Nominatim's usage policy requires a
 * User-Agent header, which browsers do not let us set.
 *
 * Response:
 *   { success: true, lat, lng, display_name, provider: "google" | "nominatim" }
 */

const bodySchema = z.object({
  q: z.string().trim().min(1).max(200),
  /** Optional bias — improves ranking when the address is ambiguous. */
  countryCode: z.string().length(2).optional(),
});

const GOOGLE_KEY =
  process.env.GOOGLE_MAPS_SERVER_KEY || process.env.GOOGLE_MAPS_API_KEY || "";

const NOMINATIM_UA =
  process.env.NOMINATIM_USER_AGENT ||
  "Satyug10MinStore/1.0 (grocery delivery; contact@satyug.local)";

async function googleForward(q: string, countryCode?: string) {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", q);
  url.searchParams.set("key", GOOGLE_KEY);
  url.searchParams.set("language", "en");
  if (countryCode) url.searchParams.set("region", countryCode.toLowerCase());
  const res = await fetch(url.toString(), { next: { revalidate: 600 } });
  if (!res.ok) throw new Error(`Google geocode ${res.status}`);
  return res.json() as Promise<{
    status: string;
    error_message?: string;
    results: Array<{
      formatted_address: string;
      geometry: { location: { lat: number; lng: number } };
    }>;
  }>;
}

async function nominatimForward(q: string, countryCode?: string) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("q", q);
  url.searchParams.set("addressdetails", "0");
  url.searchParams.set("limit", "1");
  if (countryCode) url.searchParams.set("countrycodes", countryCode.toLowerCase());
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": NOMINATIM_UA, Accept: "application/json" },
    next: { revalidate: 600 },
  });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  return res.json() as Promise<
    Array<{ lat: string; lon: string; display_name: string }>
  >;
}

async function runForward(q: string, countryCode?: string) {
  if (GOOGLE_KEY) {
    try {
      const g = await googleForward(q, countryCode);
      if (g.status === "OK" && g.results[0]) {
        const r = g.results[0];
        return ok({
          lat: r.geometry.location.lat,
          lng: r.geometry.location.lng,
          display_name: r.formatted_address,
          provider: "google",
        });
      }
      if (g.status === "ZERO_RESULTS") {
        return fail("No matching address found.", 404);
      }
      console.warn("[geocode/forward] Google status:", g.status, g.error_message);
    } catch (err: any) {
      console.warn("[geocode/forward] Google failed, falling back:", err?.message);
    }
  }

  try {
    const results = await nominatimForward(q, countryCode);
    if (!results.length) return fail("No matching address found.", 404);
    const r = results[0];
    return ok({
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      display_name: r.display_name,
      provider: "nominatim",
    });
  } catch (err: any) {
    console.error("[geocode/forward] error:", err);
    return fail(err?.message ?? "Forward geocode failed", 502);
  }
}

export const POST = handler(async (req: NextRequest) => {
  const body = await parseJson(req, bodySchema);
  if (body instanceof NextResponse) return body;
  return runForward(body.q, body.countryCode);
});

export const GET = handler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const countryCode = searchParams.get("countryCode") || undefined;
  if (!q) return fail("Missing q= query parameter.", 400);
  return runForward(q, countryCode || undefined);
});

export const OPTIONS = handleOptions;
