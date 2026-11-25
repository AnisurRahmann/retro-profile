"use client";

import { useEffect } from "react";
import { skyModel } from "@/lib/sky/model";
import { effectiveWeather, parseOverrides, skyStore, skyTime } from "@/lib/sky/store";
import { nearestPlace, solveAnchors, type Anchor } from "@/lib/sky/landscape/anchors";
import { geomNow, onViewGeometry, onViewScroll, startView, view } from "@/lib/sky/view";
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
  html.dataset.sky = m.astro.state;
  if (TEST) {
    const w = window as Window & { __sky?: Record<string, unknown> };
    w.__sky = { ...w.__sky, state: m.astro.state, elevation: m.astro.elevation, condition: m.condition, fps: w.__sky?.fps ?? 0 };
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

    // The label's place name follows the landmark nearest the viewport centre (also under reduced motion).
    let anchors: Anchor[] = [];
    const place = () => {
      const p = nearestPlace(anchors, view.y);
      skyStore.set({ place: p });
      if (TEST) {
        const w = window as unknown as { __sky?: Record<string, unknown> };
        w.__sky = { ...w.__sky, place: p };
      }
    };
    const unsubAnchors = onViewGeometry(() => {
      anchors = solveAnchors(view.sections, view.vw, view.vh, Math.max(0, view.docH - view.vh));
      place();
    });
    const unsubPlace = onViewScroll(place);
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
      unsubAnchors();
      unsubPlace();
      stopView();
      window.clearTimeout(pollTimer);
      window.clearTimeout(tick);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
