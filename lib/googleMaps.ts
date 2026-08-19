/**
 * Tiny, dependency-free client-side loader for the Google Maps JS API.
 *
 * Why hand-rolled: keeps us off @googlemaps/js-api-loader / @vis.gl/react-google-maps
 * so the bundle stays small and there's exactly one place to reason about how
 * the script is loaded. Multiple callers get the SAME promise — the <script>
 * tag is only inserted once per page.
 *
 * Env config:
 *   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY   Browser key. Restrict it to your
 *                                     production + preview origins in the
 *                                     Google Cloud console.
 *
 * Usage:
 *   const google = await loadGoogleMaps(["places", "drawing", "geometry"]);
 *   const map = new google.maps.Map(el, { center, zoom });
 */

export const GOOGLE_MAPS_BROWSER_KEY: string =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

type GoogleNamespace = typeof globalThis extends { google: infer G } ? G : any;

// Module-scoped memo so N components mounting at once share ONE load.
let inFlight: Promise<GoogleNamespace> | null = null;

/**
 * Resolves with `window.google`. Requesting extra libraries later is a no-op
 * once the script is loaded — Google's loader loads the union of libraries
 * the first time and ignores subsequent requests. So pass your worst-case
 * library set on first call for best-case behavior.
 */
export function loadGoogleMaps(libraries: string[] = []): Promise<GoogleNamespace> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("google maps: window is not defined (SSR)"));
  }
  const w = window as any;
  if (w.google?.maps) return Promise.resolve(w.google);
  if (inFlight) return inFlight;

  if (!GOOGLE_MAPS_BROWSER_KEY) {
    return Promise.reject(
      new Error(
        "google maps: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set. Add it to .env.local and restart."
      )
    );
  }

  inFlight = new Promise<GoogleNamespace>((resolve, reject) => {
    const cbName = `__gmapsReady_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    (w as any)[cbName] = () => {
      delete (w as any)[cbName];
      resolve(w.google);
    };

    const script = document.createElement("script");
    const params = new URLSearchParams({
      key: GOOGLE_MAPS_BROWSER_KEY,
      v: "weekly",
      callback: cbName,
    });
    if (libraries.length) params.set("libraries", libraries.join(","));
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      inFlight = null;
      delete (w as any)[cbName];
      reject(new Error("google maps: failed to load script"));
    };
    document.head.appendChild(script);
  });

  return inFlight;
}

/**
 * Build a signed-in-not-required Static Maps URL. Uses the SAME browser key,
 * so make sure it's authorized for the "Maps Static API" service in the
 * Google Cloud console as well as "Maps JavaScript API".
 *
 * Returns null when no key is configured so callers can render a fallback.
 */
export function staticMapUrl(opts: {
  lat: number;
  lng: number;
  zoom?: number;
  width?: number;
  height?: number;
  markerColor?: string; // hex without "#", e.g. "059669"
  scale?: 1 | 2;
}): string | null {
  if (!GOOGLE_MAPS_BROWSER_KEY) return null;
  const {
    lat,
    lng,
    zoom = 16,
    width = 640,
    height = 240,
    markerColor = "059669",
    scale = 2,
  } = opts;
  const url = new URL("https://maps.googleapis.com/maps/api/staticmap");
  url.searchParams.set("center", `${lat},${lng}`);
  url.searchParams.set("zoom", String(zoom));
  url.searchParams.set("size", `${width}x${height}`);
  url.searchParams.set("scale", String(scale));
  url.searchParams.set(
    "markers",
    `color:0x${markerColor}|${lat},${lng}`
  );
  url.searchParams.set("key", GOOGLE_MAPS_BROWSER_KEY);
  return url.toString();
}
