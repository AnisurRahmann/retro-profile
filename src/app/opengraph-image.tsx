import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { links, meta, profile, sheets, ui } from "@/content";
import { BUILD_DATE } from "@/lib/build";
import { PAPER } from "@/lib/palette";

export const alt = meta.ogAlt;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const cell = {
  display: "flex",
  flexDirection: "column",
  padding: "8px 14px",
  borderRight: `1px solid ${PAPER.ink}`,
} as const;
const cellLabel = { fontSize: 12, color: PAPER.graphite, letterSpacing: 1.5 } as const;
const cellValue = { fontSize: 18, color: PAPER.ink, letterSpacing: 1 } as const;

/** The OG card is a drawing sheet: paper, sheet border, title block, one redline circle. */
export default async function Image() {
  const [archivo, mono] = await Promise.all([
    readFile(join(process.cwd(), "src/assets/archivo-expanded-800.ttf")),
    readFile(join(process.cwd(), "src/assets/plex-mono-500.ttf")),
  ]);
  const cover = sheets[0];
  const tb = ui.titleBlock;
  const [first = "", second = ""] = profile.name.split(" ");

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: PAPER.paper,
        padding: 24,
        fontFamily: "Plex Mono",
        textTransform: "uppercase",
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          position: "relative",
          border: `3px solid ${PAPER.ink}`,
          padding: "40px 48px 0",
        }}
      >
        <div style={{ display: "flex", fontSize: 16, color: PAPER.graphite, letterSpacing: 2 }}>
          {`${ui.sheet} ${cover?.no} · ${cover?.title} · ${links.site.display}`}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 28,
            fontFamily: "Archivo",
            fontSize: 138,
            lineHeight: 0.92,
            letterSpacing: -4,
            color: PAPER.ink,
          }}
        >
          <span>{first}</span>
          <span>{second}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", marginTop: 34, position: "relative" }}>
          <div
            style={{
              display: "flex",
              fontSize: 26,
              color: PAPER.ink,
              letterSpacing: 1,
              marginLeft: 30,
            }}
          >
            {meta.jobTitle}
          </div>
          <svg
            width="470"
            height="84"
            viewBox="0 0 470 84"
            style={{ position: "absolute", left: -18, top: -26 }}
          >
            <path
              d="M40 46C34 22 120 8 240 8C370 8 452 22 448 44C444 68 350 78 226 77C110 76 22 66 30 40C34 28 60 18 96 14"
              fill="none"
              stroke={PAPER.redline}
              strokeWidth="4"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <div
          style={{
            position: "absolute",
            right: 0,
            bottom: 0,
            display: "flex",
            flexDirection: "column",
            width: 520,
            borderTop: `3px solid ${PAPER.ink}`,
            borderLeft: `3px solid ${PAPER.ink}`,
          }}
        >
          <div style={{ display: "flex", borderBottom: `1px solid ${PAPER.ink}` }}>
            <div style={{ ...cell, flex: 1 }}>
              <span style={cellLabel}>{tb.title}</span>
              <span style={{ ...cellValue, fontFamily: "Archivo", fontSize: 24 }}>
                {meta.ogTitle}
              </span>
            </div>
            <div style={{ ...cell, borderRight: "none", width: 130 }}>
              <span style={cellLabel}>{tb.sheetNo}</span>
              <span style={{ ...cellValue, fontFamily: "Archivo", fontSize: 24 }}>{cover?.no}</span>
            </div>
          </div>
          <div style={{ display: "flex" }}>
            <div style={{ ...cell, flex: 1 }}>
              <span style={cellLabel}>{tb.drawnBy}</span>
              <span style={cellValue}>{profile.drawnBy}</span>
            </div>
            <div style={{ ...cell, flex: 1 }}>
              <span style={cellLabel}>{tb.date}</span>
              <span style={cellValue}>{BUILD_DATE}</span>
            </div>
            <div style={{ ...cell, borderRight: "none", width: 130 }}>
              <span style={cellLabel}>{tb.rev}</span>
              <span style={cellValue}>{cover?.rev}</span>
            </div>
          </div>
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Archivo", data: archivo, style: "normal", weight: 800 },
        { name: "Plex Mono", data: mono, style: "normal", weight: 500 },
      ],
    },
  );
}
