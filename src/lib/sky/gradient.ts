/** The CSS sky gradient: keyframes interpolated in OKLab by sun elevation, then modulated by the weather. */
import { desaturate, hexToLab, hexToRgb, labToHex, mixLab, oklabToRgb, rgbToOklab, scaleL, type Lab, type RGB } from "./color";
import { SKY_KEYFRAMES, SUN_HIGH, SUN_LOW, SUN_MID } from "./palette";
import type { Phase } from "./astro";
import type { Condition } from "./weather";

export type SkyColors = { zenith: Lab; mid: Lab; horizon: Lab };

type Frame = { elev: number; zenith: Lab; mid: Lab; dawn: Lab; dusk: Lab };
let cache: { src: string; frames: Frame[] } | null = null;
/** Keyframes in OKLab, rebuilt only if the palette changed (lets the tuning sweep edit it in place). */
function frames(): Frame[] {
  const src = JSON.stringify(SKY_KEYFRAMES);
  if (cache?.src !== src) {
    const f = SKY_KEYFRAMES.map((k) => ({ elev: k.elev, zenith: hexToLab(k.zenith), mid: hexToLab(k.mid), dawn: hexToLab(k.dawn), dusk: hexToLab(k.dusk) }));
    cache = { src, frames: f };
  }
  return cache.frames;
}

/** Clear-sky colours for a sun elevation and a half of the day. */
export function clearSky(elevationDeg: number, phase: Phase): SkyColors {
  const FRAMES = frames();
  const first = FRAMES[0]!;
  const last = FRAMES[FRAMES.length - 1]!;
  const pick = (f: Frame) => (phase === "morning" ? f.dawn : f.dusk);
  if (elevationDeg <= first.elev) return { zenith: first.zenith, mid: first.mid, horizon: pick(first) };
  if (elevationDeg >= last.elev) return { zenith: last.zenith, mid: last.mid, horizon: pick(last) };
  let i = 0;
  while (FRAMES[i + 1]!.elev < elevationDeg) i++;
  const a = FRAMES[i]!;
  const b = FRAMES[i + 1]!;
  const t = (elevationDeg - a.elev) / (b.elev - a.elev);
  return { zenith: mixLab(a.zenith, b.zenith, t), mid: mixLab(a.mid, b.mid, t), horizon: mixLab(pick(a), pick(b), t) };
}

/** 0 at night → 1 in daylight (used to scale "by day" weather effects). */
export const dayness = (elevationDeg: number) => smoothstep(-6, 8, elevationDeg);

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** Weather on top of the clear sky: desaturation and lightness shifts per condition. */
export function withWeather(c: SkyColors, condition: Condition, elevationDeg: number): SkyColors {
  const day = dayness(elevationDeg);
  const all = (f: (x: Lab) => Lab): SkyColors => ({ zenith: f(c.zenith), mid: f(c.mid), horizon: f(c.horizon) });
  switch (condition) {
    case "overcast":
      return all((x) => scaleL(desaturate(x, 0.45), -0.08 * day));
    case "fog": {
      const d = all((x) => desaturate(x, 0.6));
      return { zenith: d.zenith, mid: scaleL(d.mid, 0.06), horizon: scaleL(d.horizon, 0.06) };
    }
    case "drizzle":
    case "rain":
      return all((x) => scaleL(desaturate(x, 0.35), -0.06));
    case "heavy-rain":
    case "thunder":
      return all((x) => scaleL(desaturate(x, 0.5), -0.12));
    case "clear":
    case "partly":
      return c;
  }
}

export function skyColors(elevationDeg: number, phase: Phase, condition: Condition): SkyColors {
  return withWeather(clearSky(elevationDeg, phase), condition, elevationDeg);
}

export function toCss(c: SkyColors): { zenith: string; mid: string; horizon: string } {
  return { zenith: labToHex(c.zenith), mid: labToHex(c.mid), horizon: labToHex(c.horizon) };
}

/** Sun disc colour for an altitude (degrees): SUN_HIGH ≥ 30°, SUN_MID at 10°, SUN_LOW at 0°, mixed in OKLab. */
export function sunColor(alt: number): RGB {
  const [low, mid, high] = [SUN_LOW, SUN_MID, SUN_HIGH].map((h) => rgbToOklab(hexToRgb(h))) as [Lab, Lab, Lab];
  if (alt >= 30) return oklabToRgb(high);
  if (alt >= 10) return oklabToRgb(mixLab(mid, high, (alt - 10) / 20));
  return oklabToRgb(mixLab(low, mid, Math.max(0, alt) / 10));
}
