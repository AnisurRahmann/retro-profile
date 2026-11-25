import { ImageResponse } from "next/og";
import { brand } from "@/lib/brand";
import { OG_SIZE, OgBars, OgPortrait, ogFonts, portraitDataUrl } from "@/lib/og";
import { profile, ui } from "@/site";

export const alt = ui.meta.title;
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  const src = await portraitDataUrl(profile.portrait);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 96px",
          background: brand.ink,
          color: brand.text,
          fontFamily: "Geist",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
          <OgPortrait src={src} size={176} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 84, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1 }}>{profile.name}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 24 }}>
              <OgBars />
              <div style={{ fontSize: 34, color: brand.graphite }}>{profile.statusLines[0]}</div>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 64, fontSize: 26, color: brand.graphite, fontFamily: "GeistMono" }}>{profile.title}</div>
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
