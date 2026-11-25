"use client";

import { useEffect } from "react";
import { skyModel } from "@/lib/sky/model";
import { effectiveWeather, parseOverrides, skyStore, skyTime } from "@/lib/sky/store";
import { isWeather } from "@/lib/sky/weather";

export const WEATHER_POLL_MS = 15 * 60_000;
const ASTRO_TICK_MS = 60_000;

/** Applies the sky model to the CSS layer: gradient colours and the state attribute (header dot). */
function paint() {
  const s = skyStore.get();
  const m = skyModel(skyTime(s), effectiveWeather(s));
  const html = document.documentElement;
  html.style.setProperty("--sky-zenith", m.css.zenith);
  html.style.setProperty("--sky-mid", m.css.mid);
  html.style.setProperty("--sky-horizon", m.css.horizon);
  html.dataset.sky = m.astro.state;
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
        const res = await fetch("/api/sylhet", { headers: { accept: "application/json" } });
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

    const unsub = skyStore.subscribe(paint);
    void load().then(schedule);
    astroLoop();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      dead = true;
      unsub();
      window.clearTimeout(pollTimer);
      window.clearTimeout(tick);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
