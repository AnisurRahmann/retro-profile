/** 10px sky glyphs in currentColor (label, strip handle). */
export type Glyph = "sun" | "moon" | "cloud" | "rain" | "bolt";

/** 10px sky glyph in currentColor. The moon shows the real phase (lit limb right while waxing). */
export function SkyGlyph({ kind, fraction = 1, waxing = true, amber }: { kind: Glyph; fraction?: number; waxing?: boolean; amber: boolean }) {
  const common = { width: 10, height: 10, viewBox: "0 0 10 10", "aria-hidden": true as const, className: "flex-none", style: amber ? { color: "var(--signal)" } : undefined };
  const s = { fill: "none", stroke: "currentColor", strokeWidth: 1.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (kind === "sun")
    return (
      <svg {...common}>
        <circle cx="5" cy="5" r="2.1" fill="currentColor" />
        <path {...s} d="M5 .6v1.1M5 8.3v1.1M.6 5h1.1M8.3 5h1.1M1.9 1.9l.8.8M7.3 7.3l.8.8M1.9 8.1l.8-.8M7.3 2.7l.8-.8" />
      </svg>
    );
  if (kind === "moon") {
    const rx = (4.2 * Math.abs(1 - 2 * fraction)).toFixed(2);
    return (
      <svg {...common}>
        <circle cx="5" cy="5" r="4.2" fill="currentColor" opacity="0.2" />
        {fraction > 0.02 ? (
          <path
            fill="currentColor"
            transform={waxing ? undefined : "matrix(-1 0 0 1 10 0)"}
            d={`M5 .8A4.2 4.2 0 0 1 5 9.2A${rx} 4.2 0 0 ${fraction > 0.5 ? 1 : 0} 5 .8Z`}
          />
        ) : null}
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path {...s} d={kind === "cloud" ? "M2.6 7.6h5a1.9 1.9 0 0 0 .1-3.8A2.6 2.6 0 0 0 2.8 4.6a1.5 1.5 0 0 0-.2 3Z" : "M2.6 5.6h5a1.9 1.9 0 0 0 .1-3.8A2.6 2.6 0 0 0 2.8 2.6a1.5 1.5 0 0 0-.2 3Z"} />
      {kind === "rain" ? <path {...s} d="M3.4 7.4l-.5 1.6M5.4 7.4l-.5 1.6M7.4 7.4l-.5 1.6" /> : null}
      {kind === "bolt" ? <path {...s} d="M5.6 6.2 4.4 8h1.4L4.8 9.6" /> : null}
    </svg>
  );
}

