"use client";

import { useEffect } from "react";

const THEME_KEY = "lights";

/**
 * All page-level behaviour in one small client island:
 * theme toggle, keyboard shortcuts, lights that switch on when scrolled into view, count-up, print prep.
 * Everything it touches already renders in its final state without JS.
 */
export function Runtime({ flightIds }: { flightIds: string[] }) {
  useEffect(() => {
    const root = document.documentElement;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cleanups: (() => void)[] = [];

    const toggleTheme = () => {
      const next = root.dataset.theme === "dark" ? "light" : "dark";
      root.dataset.theme = next;
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        // private mode: the toggle still works for this page view
      }
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-lights-toggle]")) toggleTheme();
      // close the flights menu after picking a flight, or when clicking elsewhere
      for (const menu of document.querySelectorAll<HTMLDetailsElement>("details[data-menu][open]")) {
        if (!menu.contains(target) || target?.closest("a")) menu.open = false;
      }
    };
    document.addEventListener("click", onClick);
    cleanups.push(() => document.removeEventListener("click", onClick));

    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, select, textarea, [contenteditable]")) return;
      if (event.key === "Escape") {
        document.querySelectorAll<HTMLDetailsElement>("details[data-menu][open]").forEach((menu) => (menu.open = false));
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "l") toggleTheme();
      else if (key === "g") window.location.href = "/gym/";
      else if (/^[0-8]$/.test(key)) {
        const id = flightIds[Number(key)];
        if (!id) return;
        if (document.getElementById(id)) window.location.hash = id;
        else window.location.href = `/#${id}`;
      }
    };
    document.addEventListener("keydown", onKey);
    cleanups.push(() => document.removeEventListener("keydown", onKey));

    // Your Call: tell screen readers the outcome appeared
    const onChange = (event: Event) => {
      const input = event.target as HTMLInputElement | null;
      if (!input?.closest("[data-yc], .yc-all")) return;
      const live = document.querySelector<HTMLElement>("[data-yc-live]");
      if (live) live.textContent = live.dataset.message ?? "";
    };
    document.addEventListener("change", onChange);
    cleanups.push(() => document.removeEventListener("change", onChange));

    const onPrint = () => {
      document.querySelectorAll<HTMLDetailsElement>("details[data-print-open]").forEach((node) => (node.open = true));
    };
    window.addEventListener("beforeprint", onPrint);
    cleanups.push(() => window.removeEventListener("beforeprint", onPrint));

    if (!reduced && "IntersectionObserver" in window) {
      const below = (node: Element) => node.getBoundingClientRect().top > window.innerHeight;

      // referee lights: dark until seen, then on one at a time
      const lights = [...document.querySelectorAll<HTMLElement>("[data-reveal]")].filter(below);
      lights.forEach((node) => node.setAttribute("data-armed", ""));
      const lightObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target.setAttribute("data-lit", "");
            entry.target.removeAttribute("data-armed");
            lightObserver.unobserve(entry.target);
          }
        },
        { threshold: 0.9 },
      );
      lights.forEach((node) => lightObserver.observe(node));

      // numbers count up once
      const frames = new Set<number>();
      const countObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            countObserver.unobserve(entry.target);
            const node = entry.target as HTMLElement;
            const final = node.textContent ?? "";
            const match = /\d[\d,]*(?:\.\d+)?/.exec(final);
            if (!match) continue;
            const target = Number(match[0].replace(/,/g, ""));
            const decimals = match[0].split(".")[1]?.length ?? 0;
            const grouped = match[0].includes(",");
            const started = performance.now();
            node.style.fontVariantNumeric = "tabular-nums";
            const tick = (now: number) => {
              const progress = Math.min(1, (now - started) / 700);
              const eased = 1 - (1 - progress) ** 3;
              const value = (target * eased).toFixed(decimals);
              const shown = grouped ? Number(value).toLocaleString("en-US") : value;
              node.textContent = progress === 1 ? final : final.replace(match[0], shown);
              if (progress < 1) frames.add(requestAnimationFrame(tick));
            };
            frames.add(requestAnimationFrame(tick));
          }
        },
        { threshold: 0.6 },
      );
      document.querySelectorAll<HTMLElement>("[data-countup]").forEach((node) => {
        if (below(node)) countObserver.observe(node);
      });

      cleanups.push(() => {
        lightObserver.disconnect();
        countObserver.disconnect();
        frames.forEach((frame) => cancelAnimationFrame(frame));
        document.querySelectorAll("[data-armed]").forEach((node) => node.removeAttribute("data-armed"));
      });
    }

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [flightIds]);

  return null;
}
