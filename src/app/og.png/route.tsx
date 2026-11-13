import { ImageResponse } from "next/og";
import { meta, metrics, profile } from "@/content";

export const dynamic = "force-static";

// Static Open Graph image, written to /og.png at build time.
export function GET() {
  const iron = "#17181A";
  const chalk = "#F4F2EC";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: chalk, color: iron, padding: 56, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `4px solid ${iron}`, paddingBottom: 16 }}>
          <div style={{ display: "flex", fontSize: 26, letterSpacing: 4, textTransform: "uppercase" }}>{meta.ogKicker}</div>
          <div style={{ display: "flex", background: iron, padding: "10px 14px" }}>
            {[0, 1, 2].map((light) => (
              <div key={light} style={{ width: 26, height: 26, borderRadius: 13, background: "#fff", marginLeft: light ? 10 : 0 }} />
            ))}
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 148, fontWeight: 900, textTransform: "uppercase", letterSpacing: -4, lineHeight: 1, marginTop: 36 }}>
          {profile.name}
        </div>
        <div style={{ display: "flex", fontSize: 36, marginTop: 14 }}>{meta.ogTagline}</div>
        <div style={{ display: "flex", marginTop: "auto", border: `4px solid ${iron}` }}>
          {metrics.map((metric, index) => (
            <div
              key={metric.id}
              style={{ display: "flex", flex: 1, justifyContent: "center", padding: "18px 6px", fontSize: 40, fontWeight: 900, textTransform: "uppercase", borderLeft: index ? `4px solid ${iron}` : "none" }}
            >
              {metric.plate}
            </div>
          ))}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
