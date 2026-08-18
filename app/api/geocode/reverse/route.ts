import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fail, handleOptions, handler, ok, parseJson } from "@/lib/api";

/**
 * Free reverse geocoding via Nominatim (OpenStreetMap).
 *
 * NO API KEY. NO PAYMENT. Just respect their usage policy:
 *   1. One request per second maximum. Do not batch-crawl.
 *   2. Send a real User-Agent identifying your app (they explicitly ask for
 *      this — anonymous requests can be rate-limited or banned).
 *   3. Cache results client-side so a single map interaction doesn't spam.
 *
 * If you outgrow Nominatim, three drop-in-compatible free alternatives:
 *   • BigDataCloud reverse-geocode-client (no key, unlimited, less detail)
 *   • LocationIQ (free tier: 5k req/day, needs key)
 *   • Mapbox (free tier: 100k req/month, needs key)
 *
 * POST body:  { lat: number, lng: number }
 * GET query:  ?lat=..&lng=..
 *
 * Response shape (aligned with our Address form fields):
 *   {
 *     success: true,
 *     display_name: "...",           // full formatted string
 *     houseNo: "Plot 45",            // house_number + road (best guess)
 *     area:    "Patia",              // suburb / neighbourhood / village
 *     city:    "Bhubaneswar",
 *     state:   "Odisha",
 *     country: "India",
 *     pincode: "751024",
 *     raw:     { ...Nominatim response... }  // for debugging
 *   }
 */

const bodySchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

interface NominatimAddress {
  house_number?: string;
  building?: string;
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  village?: string;
  hamlet?: string;
  town?: string;
  city?: string;
  city_district?: string;
  state_district?: string;
  county?: string;
  state?: string;
  postcode?: string;
  country?: string;
}

interface NominatimResponse {
  display_name?: string;
  address?: NominatimAddress;
  lat?: string;
  lon?: string;
  error?: string;
}

const USER_AGENT =
  process.env.NOMINATIM_USER_AGENT ||
  "Satyug10MinStore/1.0 (grocery delivery; contact@satyug.local)";

async function nominatimReverse(lat: number, lng: number): Promise<NominatimResponse> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("zoom", "18"); // building-level detail
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "en");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    // Cache identical (lat,lng) lookups for 10 minutes at the CDN level too
    next: { revalidate: 600 },
  });
  if (!res.ok) {
    throw new Error(`Nominatim ${res.status}: ${await res.text().catch(() => "")}`);
  }
  return res.json();
}

/**
 * Turn Nominatim's flat "address" object into the shape our Address form
 * wants — house/flat number, area (locality), city, pincode.
 */
function shape(nom: NominatimResponse) {
  const a = nom.address ?? {};
  const houseParts = [a.house_number, a.building].filter(Boolean).join(" ");
  const road = a.road ?? "";
  const houseNo = [houseParts, road].filter(Boolean).join(", ").trim();

  const area =
    a.neighbourhood ||
    a.suburb ||
    a.city_district ||
    a.village ||
    a.hamlet ||
    a.county ||
    "";

  const city = a.city || a.town || a.village || a.state_district || "";
  const state = a.state ?? "";
  const country = a.country ?? "";
  const pincode = a.postcode ?? "";

  return {
    display_name: nom.display_name ?? "",
    houseNo,
    area,
    city: [city, state].filter(Boolean).join(", "),
    cityOnly: city,
    state,
    country,
    pincode,
  };
}

async function runReverse(lat: number, lng: number) {
  try {
    const nom = await nominatimReverse(lat, lng);
    if (nom.error) return fail(`Reverse geocode failed: ${nom.error}`, 502);
    return ok({ ...shape(nom), raw: nom });
  } catch (err: any) {
    console.error("[geocode/reverse] error:", err);
    return fail(err?.message ?? "Reverse geocode failed", 502);
  }
}

export const POST = handler(async (req: NextRequest) => {
  const body = await parseJson(req, bodySchema);
  if (body instanceof NextResponse) return body;
  return runReverse(body.lat, body.lng);
});

export const GET = handler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return fail("Missing or invalid lat/lng", 400);
  }
  return runReverse(lat, lng);
});

export const OPTIONS = handleOptions;
