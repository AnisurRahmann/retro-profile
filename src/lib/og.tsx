import fs from "node:fs/promises";
import path from "node:path";
import { brand } from "./brand";

export const OG_SIZE = { width: 1200, height: 630 };

const fontDir = path.join(process.cwd(), "node_modules/geist/dist/fonts");

export async function ogFonts() {
  const [medium, regular, mono] = await Promise.all([
    fs.readFile(path.join(fontDir, "geist-sans/Geist-Medium.ttf")),
    fs.readFile(path.join(fontDir, "geist-sans/Geist-Regular.ttf")),
    fs.readFile(path.join(fontDir, "geist-mono/GeistMono-Regular.ttf")),
  ]);
  return [
    { name: "Geist", data: medium, weight: 500 as const, style: "normal" as const },
    { name: "Geist", data: regular, weight: 400 as const, style: "normal" as const },
    { name: "GeistMono", data: mono, weight: 400 as const, style: "normal" as const },
  ];
}

/** Portrait as a data URL, or null while public/shakil.jpg is missing. */
export async function portraitDataUrl(portrait: string): Promise<string | null> {
  try {
    const buf = await fs.readFile(path.join(process.cwd(), "public", portrait));
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export function OgPortrait({ src, size }: { src: string | null; size: number }) {
  const ring = { border: `1px solid ${brand.hairline}`, borderRadius: 9999, width: size, height: size };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- next/og renders plain <img>
    return <img src={src} width={size} height={size} style={{ ...ring, objectFit: "cover" }} alt="" />;
  }
  return (
    <div
      style={{
        ...ring,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: brand.surface2,
        color: brand.graphite,
        fontFamily: "GeistMono",
        fontSize: Math.round(size * 0.3),
      }}
    >
      as
    </div>
  );
}

export function OgBars() {
  const heights = [0.4, 0.8, 1, 0.6, 0.35];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, height: 28 }}>
      {heights.map((h, i) => (
        <div key={i} style={{ width: 5, height: 28 * h, borderRadius: 3, background: brand.signal }} />
      ))}
    </div>
  );
}
