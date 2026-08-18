import { ImageResponse } from "next/og";

/**
 * iOS home-screen icon (180×180). Next serves this at `/apple-icon` and
 * injects the correct <link rel="apple-touch-icon"> automatically.
 */

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 88,
          background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontWeight: 900,
          letterSpacing: "-0.05em",
        }}
      >
        10m
      </div>
    ),
    size
  );
}
