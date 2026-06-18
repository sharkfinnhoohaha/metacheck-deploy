import { ImageResponse } from "next/og";

export const alt = "MetaCheck — Fix your metadata before your distributor rejects it";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Dynamic Open Graph / social-share image (used for og:image and twitter:image).
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#0a0a0c",
          backgroundImage:
            "radial-gradient(ellipse at top, rgba(13,148,136,0.18) 0%, transparent 60%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 40 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 14,
              background: "#0d9488",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 36,
              fontWeight: 700,
            }}
          >
            M
          </div>
          <div style={{ color: "#e8e6e3", fontSize: 34, fontWeight: 600 }}>MetaCheck</div>
        </div>
        <div style={{ color: "#e8e6e3", fontSize: 64, fontWeight: 700, lineHeight: 1.1, maxWidth: 900 }}>
          Fix your metadata before your distributor rejects it.
        </div>
        <div style={{ color: "#8a8a95", fontSize: 30, marginTop: 28, maxWidth: 880 }}>
          Scan releases for ISRC errors, missing credits & 30+ issues. AI suggests fixes.
        </div>
      </div>
    ),
    { ...size }
  );
}
