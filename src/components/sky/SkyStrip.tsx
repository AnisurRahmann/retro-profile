"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { Content } from "@/content.schema";
import { seasonScale } from "@/lib/sky/arc";
import { moon as moonAt, skyState, sun, sunTimes } from "@/lib/sky/astro";
import { backToNow, LAST_MINUTE, minutesLabel, setPreview } from "@/lib/sky/scrub";
import { liveNow, skyTime } from "@/lib/sky/store";
import { atDhakaMinutes, dhakaParts } from "@/lib/sky/time";
import { SkyGlyph } from "./SkyGlyph";
import { fill, useHydrated, useSky } from "./hooks";

type Copy = Content["ui"]["sky"];
const DAY = 1440;
const PAD = 6;

/** Sun altitude across the Dhaka day of `now`, every 20 minutes (cached per day). */
function useDayCurve(now: Date) {
  const key = `${dhakaParts(now).y}-${dhakaParts(now).m}-${dhakaParts(now).d}`;
  return useMemo(() => {
    const alts: number[] = [];
    for (let m = 0; m <= DAY; m += 20) alts.push(sun(atDhakaMinutes(now, m)).elevationDeg);
    const { sunrise, sunset } = sunTimes(now);
    const max = Math.max(...alts);
    const min = Math.min(...alts);
    return { alts, max, min, rise: dhakaParts(sunrise).minutes, set: dhakaParts(sunset).minutes };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/**
 * The sun-path strip under the label (260×40): horizon, today's day arc (the sky arc's shape, scaled), 8px sunrise
 * and sunset ticks with their times (11px --graphite, loose text), the night below the horizon at half strength,
 * a 2px "now" dot and a 12px handle (the sun by day, the moon in its phase by night). It's a slider: drag it (pointer or touch) and the whole sky follows; let go and the sky eases
 * back to now over 1.6 s. Keys: arrows ±5 min, PageUp/PageDown ±1 h, Home/End 00:00/23:55; Escape or leaving
 * the slider returns to now.
 */
export function SkyStrip({ copy, sunrise, sunset }: { copy: Copy; sunrise: string; sunset: string }) {
  const snap = useSky();
  const hydrated = useHydrated();
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(260);
  const [mobile, setMobile] = useState(false);
  const drag = useRef<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setW(Math.round(el.clientWidth));
      setMobile(window.innerWidth < 808);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const now = liveNow(snap);
  const curve = useDayCurve(now);
  const H = mobile ? 36 : 40;
  const y0 = H - 17; // horizon; the tick labels sit under it
  const top = 6;
  const dip = 6;
  const nowMin = dhakaParts(now).minutes;
  const value = snap.preview ?? nowMin;
  const shown = ((value % DAY) + DAY) % DAY;
  const x = (m: number) => PAD + ((w - 2 * PAD) * m) / DAY;
  const k = seasonScale(curve.max);
  const yAt = (alt: number) => (alt >= 0 ? y0 - (y0 - top) * k * (alt / Math.max(1, curve.max)) : y0 + dip * Math.min(1, alt / Math.min(-1, curve.min)));
  const pts = curve.alts.map((a, i) => [x(i * 20), yAt(a)] as const);
  const day = pts.filter((_, i) => curve.alts[i]! >= 0 || curve.alts[i + 1]! >= 0 || curve.alts[i - 1]! >= 0);
  // The night segments: below the horizon, split where the day is.
  const nights: (readonly [number, number])[][] = [[]];
  curve.alts.forEach((a, i) => {
    if (a < 0 || curve.alts[i - 1]! < 0 || curve.alts[i + 1]! < 0) nights[nights.length - 1]!.push(pts[i]!);
    else if (nights[nights.length - 1]!.length) nights.push([]);
  });
  const path = (p: readonly (readonly [number, number])[]) => p.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)} ${py.toFixed(1)}`).join("");
  const at = skyTime(snap);
  const alt = sun(at).elevationDeg;
  const m = moonAt(at);
  const hx = x(shown);
  const hy = Math.max(top, Math.min(y0 + dip, yAt(alt)));
  const nowAlt = sun(now).elevationDeg;
  const ny = Math.max(top, Math.min(y0 + dip, yAt(nowAlt)));
  const phase = copy.phases[skyState(alt)];

  const minuteAt = (clientX: number) => {
    const r = box.current!.getBoundingClientRect();
    return Math.round(Math.min(LAST_MINUTE, Math.max(0, ((clientX - r.left - PAD) / (r.width - 2 * PAD)) * DAY)));
  };
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = e.pointerId;
    e.currentTarget.focus({ preventScroll: true });
    setPreview(minuteAt(e.clientX));
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current === e.pointerId) setPreview(minuteAt(e.clientX));
  };
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current !== e.pointerId) return;
    drag.current = null;
    backToNow();
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const d: Record<string, number> = { ArrowLeft: -5, ArrowDown: -5, ArrowRight: 5, ArrowUp: 5, PageDown: -60, PageUp: 60 };
    const base = Math.round(shown / 5) * 5;
    if (e.key in d) setPreview(Math.min(LAST_MINUTE, Math.max(0, base + d[e.key]!)));
    else if (e.key === "Home") setPreview(0);
    else if (e.key === "End") setPreview(LAST_MINUTE);
    else if (e.key === "Escape" && snap.preview !== null) backToNow();
    else return;
    e.preventDefault();
  };

  return (
    <div
      ref={box}
      role="slider"
      tabIndex={0}
      aria-label={copy.scrub}
      aria-valuemin={0}
      aria-valuemax={LAST_MINUTE}
      aria-valuenow={Math.round(shown)}
      aria-valuetext={fill(copy.stripValue, { time: minutesLabel(shown), phase })}
      aria-orientation="horizontal"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onKeyDown={onKey}
      onBlur={() => {
        if (drag.current === null && snap.preview !== null) backToNow();
      }}
      className="sky-strip mt-2"
      data-testid="sky-strip"
    >
      <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} preserveAspectRatio="none" aria-hidden="true" className="block overflow-visible">
        <line x1={PAD} x2={w - PAD} y1={y0} y2={y0} className="stroke-hairline" strokeWidth={1} />
        {hydrated ? (
          <>
            {/* Night: under the horizon, at half strength. */}
            {nights
              .filter((n) => n.length > 1)
              .map((n, i) => (
                <path key={i} d={path(n)} fill="none" stroke="currentColor" strokeOpacity={0.25} strokeWidth={1} />
              ))}
            <path d={path(day)} fill="none" stroke="currentColor" strokeOpacity={0.6} strokeWidth={1} />
            {[curve.rise, curve.set].map((mm, i) => (
              <line key={i} x1={x(mm)} x2={x(mm)} y1={y0 - 4} y2={y0 + 4} stroke="currentColor" strokeOpacity={0.7} />
            ))}
            {/* Now: a 2px dot on the path, visible while the handle is dragged elsewhere. */}
            <circle cx={x(nowMin)} cy={ny} r={1} fill="currentColor" data-testid="sky-strip-now" />
            <g transform={`translate(${(hx - 5).toFixed(1)} ${(hy - 5).toFixed(1)})`} data-testid="sky-strip-handle">
              <circle cx={5} cy={5} r={6} className="fill-ink" fillOpacity={0.7} />
              <SkyGlyph kind={alt < -6 ? "moon" : "sun"} fraction={m.fraction} waxing={m.waxing} amber={alt >= -6 && alt < 8} />
            </g>
          </>
        ) : null}
      </svg>
      {hydrated
        ? [
            [curve.rise, sunrise, "strip-rise"],
            [curve.set, sunset, "strip-set"],
          ].map(([mm, label, sky], i) => (
            <span
              key={sky as string}
              className="sky-strip-tick"
              style={{ left: x(mm as number), top: y0 + 5, transform: i ? "translateX(-100%)" : undefined }}
              data-on-sky={sky as string}
            >
              {label}
            </span>
          ))
        : null}
    </div>
  );
}
