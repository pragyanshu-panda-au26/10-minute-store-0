import { ImageResponse } from "next/og";

/**
 * Dynamically-generated favicon / PWA icon.
 * Next generates `/icon` at build time using this component and inserts a
 * <link rel="icon"> automatically. No PNG files to maintain.
 *
 * Also used as the manifest fallback icon at 512×512. Swap for a proper
 * illustrated icon before launch.
 */

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 256,
          background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontWeight: 900,
          letterSpacing: "-0.05em",
          borderRadius: 96,
        }}
      >
        10m
      </div>
    ),
    size
  );
}
