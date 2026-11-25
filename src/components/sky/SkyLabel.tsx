"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import type { Content } from "@/content.schema";
import { skyState, sun, sunTimes, moon as moonAt } from "@/lib/sky/astro";
import { effectiveWeather, liveNow, skyStore, skyTime, type SkySnapshot } from "@/lib/sky/store";
import { dhakaParts, formatHM } from "@/lib/sky/time";
import { compass, hasWeather, weatherWord } from "@/lib/sky/weather";
import { SylhetClock } from "./SylhetClock";

type Copy = Content["ui"]["sky"];
const fill = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ""));
const DAY_MIN = 24 * 60;
const LAST = DAY_MIN - 5;
const BACK_MS = 1200;

const SERVER: SkySnapshot = skyStore.get();
const useSky = () => useSyncExternalStore(skyStore.subscribe, skyStore.get, () => SERVER);
const noop = () => () => {};
/** false during SSR and hydration, true after: the page is static, so nothing time-dependent renders before. */
const useHydrated = () => useSyncExternalStore(noop, () => true, () => false);

type Glyph = "sun" | "moon" | "cloud" | "rain" | "bolt";

/** 10px sky glyph in currentColor. The moon shows the real phase (lit limb right while waxing). */
function SkyGlyph({ kind, fraction = 1, waxing = true, amber }: { kind: Glyph; fraction?: number; waxing?: boolean; amber: boolean }) {
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

const minutesLabel = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** "07:52 in Sylhet · 24°C · light rain", a button that opens the sky popover with the day scrubber. */
export function SkyLabel({ copy }: { copy: Copy }) {
  const snap = useSky();
  const [open, setOpen] = useState(false);
  const [, tick] = useState(0);
  const id = useId();
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const range = useRef<HTMLInputElement>(null);
  const anim = useRef(0);

  // Re-derive the glyph each minute (the clock itself ticks on its own).
  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const hydrated = useHydrated();
  const now = liveNow(snap);
  const at = skyTime(snap);
  const w = effectiveWeather(snap);
  const showWx = hydrated && hasWeather(w);
  const s = sun(at);
  const state = skyState(s.elevationDeg);
  const dark = s.elevationDeg < -6;
  const m = moonAt(at);
  const glyph: Glyph = !showWx || w.condition === "clear" ? (dark ? "moon" : "sun") : w.condition === "thunder" ? "bolt" : ["drizzle", "rain", "heavy-rain"].includes(w.condition) ? "rain" : "cloud";
  const amber = glyph === "sun" && (state === "golden" || state === "civil");
  const times = sunTimes(now);
  // Open-Meteo's times for today; suncalc's when there's no data or ?sky= moved the date.
  const api = !snap.timeOverride && w.sunrise && w.sunset;
  const sunrise = formatHM(api ? new Date(w.sunrise!) : times.sunrise);
  const sunset = formatHM(api ? new Date(w.sunset!) : times.sunset);
  const nowMin = dhakaParts(now).minutes;
  const value = snap.preview ?? Math.min(LAST, Math.round(nowMin / 5) * 5);
  const pct = (d: string) => {
    const [h = 0, mm = 0] = d.split(":").map(Number);
    return `${((h * 60 + mm) / DAY_MIN) * 100}%`;
  };

  const setPreview = (v: number) => {
    cancelAnimationFrame(anim.current);
    skyStore.set({ preview: Math.max(0, Math.min(LAST, v)), scrubbing: true });
  };

  const close = () => {
    setOpen(false);
    btn.current?.focus();
    const from = skyStore.get().preview;
    const to = dhakaParts(liveNow()).minutes;
    if (from === null || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      skyStore.set({ preview: null, scrubbing: false });
      return;
    }
    const t0 = performance.now();
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / BACK_MS);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      if (k >= 1) skyStore.set({ preview: null, scrubbing: false });
      else {
        skyStore.set({ preview: from + (to - from) * e, scrubbing: true });
        anim.current = requestAnimationFrame(step);
      }
    };
    anim.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    if (!open) return;
    skyStore.set({ scrubbing: true });
    range.current?.focus();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!pop.current?.contains(t) && !btn.current?.contains(t)) close();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  useEffect(() => () => cancelAnimationFrame(anim.current), []);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key !== "Tab" || !pop.current) return;
    const f = [...pop.current.querySelectorAll<HTMLElement>("a[href],button,input")];
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  };

  const onRangeKey = (e: KeyboardEvent<HTMLInputElement>) => {
    const d: Record<string, number> = { ArrowLeft: -5, ArrowDown: -5, ArrowRight: 5, ArrowUp: 5, PageDown: -60, PageUp: 60 };
    if (e.key in d) setPreview(value + d[e.key]!);
    else if (e.key === "Home") setPreview(0);
    else if (e.key === "End") setPreview(LAST);
    else return;
    e.preventDefault();
  };

  const scrubbing = snap.preview !== null;
  const [before, after] = copy.label.split("{time}");

  return (
    <div className="relative mt-2">
      <button
        ref={btn}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? `${id}-pop` : undefined}
        onClick={() => (open ? close() : setOpen(true))}
        className="sky-label inline-flex items-center gap-1.5 font-mono text-xs leading-5 text-on-sky transition-colors duration-150 hover:text-text"
        data-testid="sky-label"
      >
        {hydrated ? <SkyGlyph kind={glyph} fraction={m.fraction} waxing={m.waxing} amber={amber} /> : <span className="size-2.5 flex-none" />}
        {hydrated && scrubbing ? (
          <span className="text-signal" data-testid="sky-preview">
            {fill(copy.preview, { time: minutesLabel(Math.round(snap.preview!)) })}
          </span>
        ) : (
          <span>
            {before}
            <SylhetClock />
            {after}
          </span>
        )}
        {showWx ? (
          <span data-testid="sky-weather">
            {" · "}
            {fill(copy.weather, { temp: Math.round(w.tempC!), weather: copy.words[weatherWord(w)] })}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          ref={pop}
          id={`${id}-pop`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${id}-title`}
          onKeyDown={onKey}
          className="sky-pop glass absolute top-full left-0 z-20 mt-2 w-[min(408px,calc(100vw-40px))] rounded-lg border border-hairline p-4 font-mono text-xs leading-5 text-graphite"
        >
          <h2 id={`${id}-title`} className="sr-only">
            {copy.dialog}
          </h2>
          <p>{fill(copy.sun, { sunrise, sunset })}</p>
          {showWx ? (
            <p>
              {fill(copy.details, {
                feels: Math.round(w.feelsC ?? w.tempC!),
                humidity: Math.round(w.humidity ?? 0),
                wind: Math.round(w.windKmh),
                from: compass(w.windFromDeg),
              })}
            </p>
          ) : null}
          <p>
            {w.observedAt ? `${fill(copy.updated, { time: formatHM(new Date(w.observedAt)) })} · ` : null}
            <a href={copy.attributionHref} target="_blank" rel="noopener" className="text-text underline decoration-hairline underline-offset-4 hover:decoration-graphite">
              {copy.attribution}
            </a>
          </p>

          <label htmlFor={`${id}-range`} className="mt-4 block text-text">
            {copy.scrub}
          </label>
          <div className="relative mt-2">
            <input
              ref={range}
              id={`${id}-range`}
              type="range"
              min={0}
              max={LAST}
              step={5}
              value={Math.round(value / 5) * 5}
              aria-valuetext={minutesLabel(Math.round(value))}
              onChange={(e) => setPreview(Number(e.target.value))}
              onKeyDown={onRangeKey}
              className="sky-range block w-full"
            />
            <div aria-hidden="true" className="relative mt-1 h-4 text-[10px] leading-4">
              {[sunrise, sunset].map((t) => (
                <span key={t} className="absolute top-0 h-1.5 w-px bg-graphite" style={{ left: pct(t) }} />
              ))}
              {["00", "06", "12", "18", "24"].map((h, i) => (
                <span key={h} className="absolute top-1.5 -translate-x-1/2" style={{ left: `${i * 25}%` }}>
                  {h}
                </span>
              ))}
            </div>
          </div>
          <button type="button" onClick={close} className="mt-4 rounded-md border border-hairline px-2.5 py-1 text-text transition-colors duration-150 hover:bg-surface-2">
            {copy.backToNow}
          </button>
        </div>
      ) : null}
    </div>
  );
}
