import type { MetadataRoute } from "next";

/**
 * PWA Web App Manifest.
 *
 * Next 16 serves this at `/manifest.webmanifest` automatically when named
 * `app/manifest.ts`. Chrome / Edge / Samsung Internet on Android will read it
 * and show an "Install app" chip in the address bar once the site is served
 * over HTTPS with a valid response for start_url.
 *
 * ICONS: Replace `/icon.png` and `/apple-icon.png` with real branded
 * artwork before launch. Next also auto-generates monochrome variants from
 * `app/icon.png` (any size, 512×512 is a safe default). Add manually:
 *   • public/icon-192.png   (192×192, "any purpose")
 *   • public/icon-512.png   (512×512, "any purpose")
 *   • public/icon-mask-512.png (512×512, "maskable" — 20% safe padding)
 *   • public/apple-icon.png (180×180, iOS home-screen)
 *
 * Until real artwork is added, the manifest still validates; Chrome shows a
 * generic icon on the install prompt.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Satyug 10-Minute Store",
    short_name: "Satyug",
    description:
      "Groceries, fresh fruits, vegetables, dairy & essentials delivered in 10 minutes by your neighbourhood store owner.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8fafc",
    theme_color: "#059669",
    categories: ["shopping", "food", "lifestyle"],
    lang: "en-IN",
    dir: "ltr",
    // These paths are generated at build time by `app/icon.tsx` and
    // `app/apple-icon.tsx` (Next 16 `ImageResponse` special files). No PNG
    // files to maintain — swap those TSX files for real branded artwork when
    // you're ready.
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
    shortcuts: [
      {
        name: "My orders",
        url: "/orders",
        description: "See past orders",
      },
      {
        name: "My profile",
        url: "/profile",
      },
    ],
  };
}
