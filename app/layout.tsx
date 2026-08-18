import type { Metadata, Viewport } from "next";
import "./globals.css";

/**
 * System-font stack (defined in globals.css) — no next/font, no external
 * network requests. See earlier comments for why.
 */

export const metadata: Metadata = {
  title: {
    default: "Satyug | 10-minute Groceries",
    template: "%s · Satyug",
  },
  description:
    "Get groceries, fresh fruits, vegetables, dairy, snacks, and household essentials delivered in 10 minutes.",
  applicationName: "Satyug",
  // PWA / iOS Home-Screen goodies
  appleWebApp: {
    capable: true,
    title: "Satyug",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    siteName: "Satyug",
    title: "Satyug | 10-minute Groceries",
    description:
      "Groceries in 10 minutes — delivered by your neighbourhood store owner.",
  },
};

// Next 16 asks for viewport / theme-color via a dedicated export.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#059669" },
    { media: "(prefers-color-scheme: dark)", color: "#022c22" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover", // enables env(safe-area-inset-*) on iOS
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
