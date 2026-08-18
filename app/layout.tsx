import type { Metadata } from "next";
import "./globals.css";

/**
 * We deliberately use a system-font stack (defined in globals.css) instead of
 * `next/font/google`. Reasons:
 *   1. Avoids a Turbopack + next/font resolution bug in Next 16
 *      ("Can't resolve '@vercel/turbopack-next/internal/font/google/font'").
 *   2. Zero external network requests for fonts — faster first paint on
 *      slow mobile connections, and no dependency on fonts.googleapis.com.
 *   3. On iOS/Android the system UI font (San Francisco / Roboto) looks
 *      indistinguishable from Geist and is already what users expect.
 *
 * If you later want a specific web font, prefer `next/font/local` with the
 * .woff2 files checked into `public/fonts/` — that path avoids the Turbopack
 * bug too and doesn't call out to Google.
 */

export const metadata: Metadata = {
  title: "10minute store | 10-Minute Express Quick-Commerce",
  description:
    "Get groceries, fresh fruits, vegetables, dairy, snacks, and household essentials delivered in 10 minutes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
