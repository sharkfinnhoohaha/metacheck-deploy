import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// PNG apple-touch-icon (Apple/Safari don't render SVG favicons).
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0d9488",
          color: "#ffffff",
          fontSize: 120,
          fontWeight: 700,
        }}
      >
        M
      </div>
    ),
    { ...size }
  );
}
