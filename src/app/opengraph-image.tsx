import { ImageResponse } from "next/og";
import { site } from "@/data/site";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#141414",
          color: "#f7f6f3",
          padding: "72px",
        }}
      >
        <div style={{ fontSize: 28, letterSpacing: "0.2em", textTransform: "uppercase" }}>
          {site.role}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 84, lineHeight: 1.05 }}>{site.name}</div>
          <div style={{ fontSize: 32, color: "#b8b5ae", maxWidth: 820 }}>
            {site.tagline}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
