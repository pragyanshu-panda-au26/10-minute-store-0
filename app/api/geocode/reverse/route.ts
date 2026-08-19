import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fail, handleOptions, handler, ok, parseJson } from "@/lib/api";

/**
 * Reverse geocoding with Google Geocoding API (preferred) and a Nominatim
 * fallback for local/dev environments that don't have a Google key.
 *
 * Env config:
 *   GOOGLE_MAPS_SERVER_KEY   Server-side key with "Geocoding API" enabled.
 *                            Falls back to GOOGLE_MAPS_API_KEY. If NEITHER
 *                            is set, we fall through to Nominatim so the app
 *                            still functions on a fresh clone.
 *
 *   NOMINATIM_USER_AGENT     UA header for OSM's Nominatim (required by
 *                            their usage policy). Defaults to a sensible
 *                            per-project string.
 *
 * Response shape (same for both providers — aligned with the customer's
 * AddressFormModal field IDs):
 *   {
 *     success: true,
 *     display_name: "...",
 *     houseNo: "Plot 45, MG Road",
 *     area:    "Patia",
 *     city:    "Bhubaneswar, Odisha",
 *     cityOnly: "Bhubaneswar",
 *     state:   "Odisha",
 *     country: "India",
 *     pincode: "751024",
 *     provider: "google" | "nominatim",
 *     raw:     { ... }        // for debugging
 *   }
 */

const bodySchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const GOOGLE_KEY =
  process.env.GOOGLE_MAPS_SERVER_KEY || process.env.GOOGLE_MAPS_API_KEY || "";

// ---------- Google Geocoding ----------

interface GoogleAddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

interface GoogleResult {
  formatted_address: string;
  address_components: GoogleAddressComponent[];
  geometry?: { location: { lat: number; lng: number } };
}

interface GoogleGeocodeResponse {
  status: string;
  error_message?: string;
  results: GoogleResult[];
}

async function googleReverse(lat: number, lng: number): Promise<GoogleGeocodeResponse> {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("latlng", `${lat},${lng}`);
  url.searchParams.set("key", GOOGLE_KEY);
  url.searchParams.set("language", "en");
  const res = await fetch(url.toString(), {
    // Cache identical lookups for 10 minutes at the platform-CDN level.
    next: { revalidate: 600 },
  });
  if (!res.ok) {
    throw new Error(`Google geocode ${res.status}: ${await res.text().catch(() => "")}`);
  }
  return res.json();
}

/** Pick a component by its type, first match wins. */
function pickComponent(comps: GoogleAddressComponent[], ...types: string[]): string {
  for (const t of types) {
    const hit = comps.find((c) => c.types.includes(t));
    if (hit) return hit.long_name;
  }
  return "";
}

/** Turn Google's flat address_components into our Address form shape. */
function shapeGoogle(nom: GoogleGeocodeResponse) {
  const top = nom.results?.[0];
  if (!top) {
    return {
      display_name: "",
      houseNo: "",
      area: "",
      city: "",
      cityOnly: "",
      state: "",
      country: "",
      pincode: "",
    };
  }
  const c = top.address_components;
  const streetNumber = pickComponent(c, "street_number");
  const route = pickComponent(c, "route", "premise");
  const houseNo = [streetNumber, route].filter(Boolean).join(" ").trim();

  const area = pickComponent(
    c,
    "sublocality_level_1",
    "sublocality",
    "neighborhood",
    "administrative_area_level_3"
  );
  const cityOnly = pickComponent(
    c,
    "locality",
    "administrative_area_level_2",
    "postal_town"
  );
  const state = pickComponent(c, "administrative_area_level_1");
  const country = pickComponent(c, "country");
  const pincode = pickComponent(c, "postal_code");

  return {
    display_name: top.formatted_address,
    houseNo,
    area,
    city: [cityOnly, state].filter(Boolean).join(", "),
    cityOnly,
    state,
    country,
    pincode,
  };
}

// ---------- Nominatim (fallback) ----------

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
  error?: string;
}

const NOMINATIM_UA =
  process.env.NOMINATIM_USER_AGENT ||
  "Satyug10MinStore/1.0 (grocery delivery; contact@satyug.local)";

async function nominatimReverse(lat: number, lng: number): Promise<NominatimResponse> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("zoom", "18");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "en");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": NOMINATIM_UA, Accept: "application/json" },
    next: { revalidate: 600 },
  });
  if (!res.ok) {
    throw new Error(`Nominatim ${res.status}: ${await res.text().catch(() => "")}`);
  }
  return res.json();
}

function shapeNominatim(nom: NominatimResponse) {
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

  const cityOnly = a.city || a.town || a.village || a.state_district || "";
  const state = a.state ?? "";
  const country = a.country ?? "";
  const pincode = a.postcode ?? "";

  return {
    display_name: nom.display_name ?? "",
    houseNo,
    area,
    city: [cityOnly, state].filter(Boolean).join(", "),
    cityOnly,
    state,
    country,
    pincode,
  };
}

// ---------- Orchestrator ----------

async function runReverse(lat: number, lng: number) {
  // Prefer Google when configured. On any transport failure fall through to
  // Nominatim so a temporary Google outage / quota trip doesn't take the
  // address flow down with it.
  if (GOOGLE_KEY) {
    try {
      const g = await googleReverse(lat, lng);
      if (g.status === "OK") {
        return ok({ ...shapeGoogle(g), provider: "google", raw: g });
      }
      // ZERO_RESULTS is a "not found", not a network error — bubble up so the
      // client can show a manual-entry prompt instead of retrying elsewhere.
      if (g.status === "ZERO_RESULTS") {
        return fail("No address found for those coordinates.", 404);
      }
      console.warn("[geocode/reverse] Google status:", g.status, g.error_message);
    } catch (err: any) {
      console.warn("[geocode/reverse] Google failed, falling back:", err?.message);
    }
  }

  try {
    const nom = await nominatimReverse(lat, lng);
    if (nom.error) return fail(`Reverse geocode failed: ${nom.error}`, 502);
    return ok({ ...shapeNominatim(nom), provider: "nominatim", raw: nom });
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
