import { ImageResponse } from "next/og";
import { OG_IMAGE } from "@/lib/metadata";

// Every page's share card points at this image through OG_IMAGE.
export const alt = OG_IMAGE.alt;
export const size = { width: OG_IMAGE.width, height: OG_IMAGE.height };
export const contentType = OG_IMAGE.type;

const BARS = [6, 15, 7, 42, 13, 6, 26, 2, 15, 23];

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0f172a",
          color: "#ffffff",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 36, fontWeight: 700 }}>
          <svg width="52" height="52" viewBox="0 0 32 32">
            <circle cx="16" cy="16" r="13" fill="none" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="3.6" />
            <path d="M16 3A13 13 0 1 1 3 16" fill="none" stroke="#f59e0b" strokeWidth="3.6" strokeLinecap="round" />
            <path
              d="M19.6 12.2C19 10.9 17.7 10.3 16 10.3C13.9 10.3 12.5 11.4 12.5 12.9C12.5 16.6 19.7 15.1 19.7 19.1C19.7 20.7 18.2 21.8 16 21.8C14.1 21.8 12.8 21.1 12.2 19.8M16 8.2V23.8"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
          CapexClock
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 48 }}>
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 640 }}>
            <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.08, letterSpacing: -1.5 }}>
              Know when every system in your building runs out.
            </div>
            <div style={{ marginTop: 24, fontSize: 28, color: "#cbd5e1" }}>
              Free 10-year CapEx forecast and monthly reserve for rental owners.
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 260 }}>
            {BARS.map((v, i) => (
              <div
                key={i}
                style={{
                  width: 26,
                  height: v * 6,
                  borderRadius: 4,
                  background: i === 3 ? "#f59e0b" : "#38bdf8",
                }}
              />
            ))}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
