"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { Content } from "@/content.schema";
import { skyState, sun, sunTimes, moon as moonAt } from "@/lib/sky/astro";
import { minutesLabel } from "@/lib/sky/scrub";
import { effectiveWeather, liveNow, skyTime, type PlaceId } from "@/lib/sky/store";
import { formatHM } from "@/lib/sky/time";
import { compass, hasWeather, weatherWord } from "@/lib/sky/weather";
import { fill, useHydrated, useSky } from "./hooks";
import { SkyGlyph, type Glyph } from "./SkyGlyph";
import { SkyStrip } from "./SkyStrip";
import { SylhetClock } from "./SylhetClock";

type Copy = Content["ui"]["sky"];

const PLACES: (PlaceId | "default")[] = ["default", "tea", "bridge", "city", "airport"];

/**
 * "07:52 near Keane Bridge, Sylhet · 24°C · light rain": a button that opens the sky popover (sun times, weather
 * details, attribution), then the sun-path strip. The place name follows the landscape as you scroll; every
 * variant is stacked in one grid cell so the line's width never changes (no layout shift).
 */
export function SkyLabel({ copy }: { copy: Copy }) {
  const snap = useSky();
  const [open, setOpen] = useState(false);
  const [, tick] = useState(0);
  const id = useId();
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);

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

  const close = () => {
    setOpen(false);
    btn.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    pop.current?.querySelector<HTMLElement>("a[href]")?.focus();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!pop.current?.contains(t) && !btn.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

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

  const scrubbing = hydrated && snap.preview !== null;
  const place = hydrated ? (snap.place ?? "default") : "default";

  return (
    <div className="relative mt-2">
      <button
        ref={btn}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? `${id}-pop` : undefined}
        onClick={() => (open ? close() : setOpen(true))}
        className="sky-label inline-flex flex-wrap items-center gap-x-1.5 text-left font-mono text-xs leading-5 whitespace-nowrap text-on-sky transition-colors duration-150 hover:text-text"
        data-wraps=""
        data-testid="sky-label"
      >
        {hydrated ? <SkyGlyph kind={glyph} fraction={m.fraction} waxing={m.waxing} amber={amber} /> : <span className="size-2.5 flex-none" />}
        {/* While scrubbing, "preview 18:40" is laid over the clock and the place (they keep their space, hidden),
            so nothing on the line moves. */}
        <span className="relative inline-flex items-center gap-x-1.5">
          <span className={scrubbing ? "invisible" : undefined}>
            <SylhetClock />
          </span>
          <span className={`sky-place${scrubbing ? " invisible" : ""}`} data-testid="sky-place">
            {PLACES.map((p) => (
              <span key={p} aria-hidden={p !== place} data-active={p === place ? "" : undefined}>
                {copy.places[p]}
              </span>
            ))}
          </span>
          {scrubbing ? (
            <span className="absolute top-0 left-0 text-signal" data-testid="sky-preview">
              {fill(copy.preview, { time: minutesLabel(snap.preview!) })}
            </span>
          ) : null}
        </span>
        {showWx ? (
          <span data-testid="sky-weather">
            {"· "}
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
        </div>
      ) : null}

      <SkyStrip copy={copy} sunrise={sunrise} sunset={sunset} />
    </div>
  );
}
