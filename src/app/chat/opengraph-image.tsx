import { ImageResponse } from "next/og";
import { brand } from "@/lib/brand";
import { OG_SIZE, OgPortrait, ogFonts, portraitDataUrl } from "@/lib/og";
import { profile, ui } from "@/site";

export const alt = ui.meta.chatTitle;
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
          alignItems: "center",
          justifyContent: "center",
          background: brand.ink,
          color: brand.text,
          fontFamily: "Geist",
        }}
      >
        <div style={{ position: "relative", display: "flex", width: 196, height: 196, alignItems: "center", justifyContent: "center" }}>
          <svg width="196" height="196" viewBox="0 0 196 196" style={{ position: "absolute", top: 0, left: 0 }}>
            <circle cx="98" cy="98" r="96" fill="none" stroke={brand.graphite} strokeWidth="2.5" strokeDasharray="2 10" strokeLinecap="round" />
          </svg>
          <OgPortrait src={src} size={152} />
        </div>
        <div style={{ marginTop: 48, fontSize: 76, fontWeight: 500, letterSpacing: "-0.02em" }}>{ui.meta.chatTitle}</div>
        <div style={{ marginTop: 18, fontSize: 30, color: brand.graphite }}>{ui.chat.heading}</div>
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
