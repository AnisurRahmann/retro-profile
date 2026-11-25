"use client";

import { useEffect } from "react";
import { sunColor } from "@/lib/sky/gradient";
import { skyModel } from "@/lib/sky/model";
import { columnMask, HERO_TARGETS, MOON_COLUMN_PX, regionScrim, scrimProfile, SCRIM_FALLOFF_PX, SUN_UNDER_TEXT, type Disc } from "@/lib/sky/scrim";
import { effectiveWeather, parseOverrides, skyStore, skyTime } from "@/lib/sky/store";
import { geomNow, onViewGeometry, runtime, startView, view } from "@/lib/sky/view";
import { isWeather } from "@/lib/sky/weather";

const TEST = process.env.NEXT_PUBLIC_E2E === "1";

export const WEATHER_POLL_MS = 15 * 60_000;
const ASTRO_TICK_MS = 60_000;

/** Applies the sky model to the CSS layer: gradient colours and the state attribute (header dot). */
function paint() {
  const s = skyStore.get();
  const m = skyModel(skyTime(s), effectiveWeather(s), geomNow());
  const html = document.documentElement;
  html.style.setProperty("--sky-zenith", m.css.zenith);
  html.style.setProperty("--sky-mid", m.css.mid);
  html.style.setProperty("--sky-horizon", m.css.horizon);
  // How much of the moon disc can sit behind the column scrim (it's dimmed there, and the scrim accounts for it).
  const { vw, vh } = view;
  const inColumn = m.moon.up && columnMask(m.moon.x * vw, vw) > 0;
  const moon = inColumn ? m.night * Math.max(0, 1 - 1.05 * m.cloudCover) ** 0.7 * (1 - 0.6 * m.fog) : 0;
  // The sun, dimmed to SUN_UNDER_TEXT behind text, counts where it can sit under the column or the hero.
  const sunDisc: Disc | null = m.sun.up ? { y: m.sun.y, rgb: sunColor(m.sun.alt), alpha: SUN_UNDER_TEXT } : null;
  const sunInColumn = sunDisc && columnMask(m.sun.x * vw, vw) > 0 ? sunDisc : null;
  // Measured cloud presence (the renderer's cloud field), when it runs: over the column band, and around the
  // hero and header with a 200px margin for a minute of drift.
  const cloudsIn = runtime.cloudsIn;
  const half = vw < 808 ? vw / 2 : MOON_COLUMN_PX / 2 + SCRIM_FALLOFF_PX;
  const colClouds = cloudsIn ? Math.max(0, cloudsIn(vw / 2 - half, 0, vw / 2 + half, vh)) : undefined;
  const profile = scrimProfile({ ...m, clouds: colClouds }, moon, m.moon.y, sunInColumn);
  profile.forEach((a, i) => html.style.setProperty(`--scrim-${i}`, String(a)));
  const scrim = Math.max(...profile);
  // Text scrims over the open stage, solved at scroll 0 (document px = viewport px there).
  const block = (r: typeof view.hero) => {
    if (!r) return 0;
    const clouds = cloudsIn ? Math.max(0, cloudsIn(r.x - 200, r.y - 200, r.x + r.w + 200, r.y + r.h + 200)) : undefined;
    const near = sunDisc && m.sun.x * vw > r.x - 60 && m.sun.x * vw < r.x + r.w + 60 ? sunDisc : null;
    return regionScrim({ ...m, clouds }, r.y / vh, (r.y + r.h) / vh, HERO_TARGETS, near);
  };
  html.style.setProperty("--hero-a", String(block(view.hero)));
  html.style.setProperty("--head-a", String(block(view.head)));
  html.dataset.sky = m.astro.state;
  if (TEST) {
    const w = window as Window & { __sky?: Record<string, unknown> };
    w.__sky = { ...w.__sky, state: m.astro.state, elevation: m.astro.elevation, scrimA: scrim, condition: m.condition, fps: w.__sky?.fps ?? 0 };
  }
  if (s.scrubbing) html.dataset.skyScrub = "";
  else delete html.dataset.skyScrub;
  return m;
}

/**
 * Keeps the sky in sync with Sylhet: fetches /api/sylhet on load and every 15 minutes while the tab is
 * visible, recomputes astronomy every 60 s, and repaints the CSS gradient on every change.
 * Renders nothing.
 */
export function SkyController() {
  useEffect(() => {
    skyStore.set(parseOverrides(window.location.search));

    let lastFetch = -Infinity;
    let pollTimer = 0;
    let dead = false;
    const load = async () => {
      lastFetch = Date.now();
      try {
        // no-cache: the response's stale-while-revalidate is for the CDN; in the browser it would serve the
        // previous poll's copy and revalidate behind it, so every update would arrive one poll late.
        const res = await fetch("/api/sylhet", { cache: "no-cache", headers: { accept: "application/json" } });
        const body: unknown = res.ok ? await res.json() : null;
        if (!dead) skyStore.set({ weather: isWeather(body) ? body : skyStore.get().weather, loaded: true });
      } catch {
        if (!dead) skyStore.set({ loaded: true });
      }
    };
    const schedule = () => {
      window.clearTimeout(pollTimer);
      if (document.hidden) return;
      const wait = Math.max(0, lastFetch + WEATHER_POLL_MS - Date.now());
      pollTimer = window.setTimeout(() => {
        void load().then(schedule);
      }, wait);
    };

    let tick = 0;
    const astroLoop = () => {
      window.clearTimeout(tick);
      paint();
      if (!document.hidden) tick = window.setTimeout(astroLoop, ASTRO_TICK_MS);
    };

    const onVisibility = () => {
      schedule();
      astroLoop();
    };

    const stopView = startView();
    const unsubView = onViewGeometry(paint);
    const unsub = skyStore.subscribe(paint);
    void load().then(schedule);
    astroLoop();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      dead = true;
      unsub();
      unsubView();
      stopView();
      window.clearTimeout(pollTimer);
      window.clearTimeout(tick);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
