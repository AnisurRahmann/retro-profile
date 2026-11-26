/**
 * The DOM side of per-element backing (src/lib/sky/backing.ts). Loaded with the renderer (idle chunk); until it
 * runs, every [data-on-sky] element wears the conservative CSS default (halo at a = 0.5, globals.css), which keeps
 * the first frame readable at any time of day. Then each element is relaxed to "none" or upgraded to "chip".
 *
 * Writes `data-backing` (none | halo | chip) and `--halo-a` / `--chip-a` (inline), only when they change. The hero's
 * text (HERO_TEXT) never wears a chip while a scrub or the time-lapse runs: the strongest halo instead (v5.1 T10).
 * Recomputes: whenever the renderer asks (the 60 s sky tick, weather, preview/scrub; throttled to 10 Hz), on
 * layout changes, and on scroll (8 Hz, only elements in view: one IntersectionObserver). New elements (chat
 * replies) are picked up by a MutationObserver.
 */
import {
  backgroundFor,
  clearingFor,
  decide,
  parseCssColor,
  TEXT,
  weightOf,
  type Box,
  type Decision,
  type Scene,
  type Style,
} from "@/lib/sky/backing";
import { luminance, type RGB } from "@/lib/sky/color";
import { skyStore } from "@/lib/sky/store";
import { onViewGeometry, onViewScroll, view } from "@/lib/sky/view";

const TEST = process.env.NEXT_PUBLIC_E2E === "1";
const SCROLL_MS = 125;
const UPDATE_MS = 100;

/** The hero's text: `data-on-sky` ids (backing.ts Style.hero). */
const HERO_TEXT = new Set(["name", "status", "one-liner", "label"]);

type Info = { rgb: RGB; px: number; weight: number };
export type BackingReport = { id: string; mode: string; a: number; contrast: number; bg: string; clear: number };

/** A loose text's clearing zone in document px, and how much alpha a cloud keeps behind it (backing.ts clearingFor). */
export type ClearZone = { x0: number; y0: number; x1: number; y1: number; f: number };

export function startBacking(scene: () => Omit<Scene, "vw" | "vh">, onZones?: (z: ClearZone[]) => void) {
  const els = new Set<HTMLElement>();
  const inView = new Set<HTMLElement>();
  const info = new WeakMap<HTMLElement, Info>();
  const last = new WeakMap<HTMLElement, string>();
  const report = new Map<HTMLElement, BackingReport>();
  const zones = new Map<HTMLElement, ClearZone>();
  let zoneKey = "";
  let dead = false;

  /**
   * The element's dimmest text colour (mixed-colour lines are judged by their secondary part), its font size (the
   * smallest in it) and its own weight.
   */
  const infoOf = (el: HTMLElement): Info => {
    let i = info.get(el);
    if (!i) {
      const cs = getComputedStyle(el);
      let rgb = parseCssColor(cs.color) ?? TEXT;
      let px = parseFloat(cs.fontSize) || 16;
      const weight = weightOf(cs.fontWeight);
      const kids = el.querySelectorAll<HTMLElement>("*");
      for (let k = 0; k < Math.min(kids.length, 24); k++) {
        const kid = kids[k]!;
        if (!kid.textContent?.trim()) continue;
        const kc = getComputedStyle(kid);
        if (kc.visibility === "hidden") continue;
        const c = parseCssColor(kc.color);
        if (c && luminance(c) < luminance(rgb)) rgb = c;
        px = Math.min(px, parseFloat(kc.fontSize) || px);
      }
      i = { rgb, px, weight };
      info.set(el, i);
    }
    return i;
  };

  const write = (el: HTMLElement, d: Decision) => {
    // Test builds: the halo calibration probe freezes the backing to set it by hand.
    if (TEST && "backingFreeze" in document.documentElement.dataset) return;
    const key = `${d.mode}|${d.a}`;
    if (last.get(el) === key) return;
    last.set(el, key);
    el.dataset.backing = d.mode;
    el.style.setProperty("--halo-a", d.mode === "halo" ? String(d.a) : "0");
    if (d.mode === "chip") el.style.setProperty("--chip-a", String(d.a));
  };

  const run = (targets: Iterable<HTMLElement>) => {
    if (dead) return;
    const s: Scene = { ...scene(), vw: view.vw, vh: view.vh };
    const dpr = window.devicePixelRatio || 1;
    for (const el of targets) {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const box: Box = { x0: r.left, y0: r.top, x1: r.right, y1: r.bottom };
      const { rgb, px, weight } = infoOf(el);
      const style = { weight, hero: HERO_TEXT.has(el.dataset.onSky ?? ""), scrubbing: skyStore.get().scrubbing } satisfies Style;
      // How far the clouds behind it are thinned, then the backing over what is left of them.
      const f = clearingFor(s, box, rgb, px, dpr, style);
      zones.set(el, { x0: r.left, y0: r.top + view.y, x1: r.right, y1: r.bottom + view.y, f });
      const bg = backgroundFor(s, box, f);
      const d = decide(bg, rgb, px, dpr, style);
      write(el, d);
      if (TEST) {
        const hex = `#${bg.map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("")}`;
        report.set(el, { id: el.dataset.onSky || el.tagName.toLowerCase(), mode: d.mode, a: d.a, contrast: Math.round(d.contrast * 100) / 100, bg: hex, clear: f });
      }
    }
    if (onZones) {
      for (const el of zones.keys()) if (!el.isConnected) zones.delete(el);
      const list = [...zones.values()];
      const key = list.map((z) => `${Math.round(z.x0)},${Math.round(z.y0)},${Math.round(z.x1)},${Math.round(z.y1)},${z.f}`).join(";");
      if (key !== zoneKey) {
        zoneKey = key;
        onZones(list);
      }
    }
    if (TEST) {
      const w = window as unknown as { __sky?: Record<string, unknown> };
      w.__sky = { ...w.__sky, backing: [...report.entries()].filter(([el]) => el.isConnected).map(([, v]) => v) };
    }
  };

  const io = new IntersectionObserver(
    (entries) => {
      const fresh: HTMLElement[] = [];
      for (const e of entries) {
        const el = e.target as HTMLElement;
        if (e.isIntersecting) {
          if (!inView.has(el)) fresh.push(el);
          inView.add(el);
        } else inView.delete(el);
      }
      if (fresh.length) run(fresh);
    },
    { rootMargin: "64px 0px" },
  );

  const scan = () => {
    document.querySelectorAll<HTMLElement>("[data-on-sky]").forEach((el) => {
      if (els.has(el)) return;
      els.add(el);
      io.observe(el);
    });
    for (const el of els)
      if (!el.isConnected) {
        els.delete(el);
        inView.delete(el);
        report.delete(el);
        io.unobserve(el);
      }
  };

  // Throttles: leading + trailing.
  const throttle = (ms: number, fn: () => void) => {
    let at = -Infinity;
    let timer = 0;
    return () => {
      const now = performance.now();
      if (now - at >= ms) {
        at = now;
        fn();
      } else if (!timer)
        timer = window.setTimeout(() => {
          timer = 0;
          at = performance.now();
          fn();
        }, ms - (now - at));
    };
  };
  const onScroll = throttle(SCROLL_MS, () => run(inView));
  const update = throttle(UPDATE_MS, () => run(inView));

  let scanTimer = 0;
  const mo = new MutationObserver(() => {
    window.clearTimeout(scanTimer);
    scanTimer = window.setTimeout(() => {
      scan();
      run(inView);
    }, 200);
  });

  scan();
  mo.observe(document.body, { childList: true, subtree: true });
  const unsubScroll = onViewScroll(onScroll);
  const unsubGeom = onViewGeometry(() => {
    scan();
    run(inView);
  });

  return {
    /** The sky changed (tick, weather, preview, the cloud field): recompute elements in view (≤ 10 Hz). */
    update,
    stop() {
      dead = true;
      io.disconnect();
      mo.disconnect();
      window.clearTimeout(scanTimer);
      unsubScroll();
      unsubGeom();
    },
  };
}

export type BackingRunner = ReturnType<typeof startBacking>;
