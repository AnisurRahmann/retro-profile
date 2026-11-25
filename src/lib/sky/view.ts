/**
 * Live page geometry the sky needs (client only): scroll position, the sky stage, the hero and header text blocks
 * and the section tops the landscape anchors to. Rects are in document px. Updated on resize and layout changes
 * (ResizeObserver on <body>); scrollY is stored by a passive listener and applied in rAF.
 */
import { arcGeom, stageHeightFor, type ArcGeom } from "./arc";
import { SCRIM_RAMP_PX } from "./scrim";

export type Rect = { x: number; y: number; w: number; h: number };
export type View = {
  y: number;
  vw: number;
  vh: number;
  /** Bottom of the sky stage in document px; 0 when the page has no stage. */
  stage: number;
  /** The hero text block and the header row, document px (null when absent). */
  hero: Rect | null;
  head: Rect | null;
  /** Section tops in document px, by id (stage, shipped, bench, receipts, closer, footer). */
  sections: Record<string, number>;
  docH: number;
};

export const view: View = { y: 0, vw: 1440, vh: 900, stage: 0, hero: null, head: null, sections: {}, docH: 0 };

/** Where the column scrim starts, in viewport px: the stage bottom as it scrolls up, or fully on when there's no stage. */
export const scrimTop = (v: View = view) => (v.stage ? Math.max(-SCRIM_RAMP_PX, v.stage - v.y) : -SCRIM_RAMP_PX);

const geometry = new Set<() => void>();
const scrolls = new Set<() => void>();
/** Layout changed (resize, content height). */
export const onViewGeometry = (l: () => void) => (geometry.add(l), () => void geometry.delete(l));
/** Scroll applied (once per frame at most). */
export const onViewScroll = (l: () => void) => (scrolls.add(l), () => void scrolls.delete(l));

const docRect = (el: Element | null): Rect | null => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height };
};

function measure() {
  view.vw = window.innerWidth;
  // The fixed layers are 100lvh: the URL bar collapsing on iOS doesn't move the sky.
  view.vh = document.querySelector("[data-sky-gradient]")?.clientHeight || window.innerHeight;
  view.y = window.scrollY;
  const stage = document.querySelector("[data-sky-stage]");
  const s = docRect(stage);
  view.stage = s ? s.y + s.h : 0;
  view.hero = docRect(document.querySelector("[data-sky-hero]"));
  view.head = stage ? docRect(document.querySelector("[data-sky-head]")) : null;
  const sections: Record<string, number> = {};
  if (s) sections.stage = s.y;
  for (const id of ["shipped", "bench", "receipts", "closer"]) {
    const r = docRect(document.getElementById(id));
    if (r) sections[id] = r.y;
  }
  const footer = docRect(document.querySelector("footer"));
  if (footer && s) sections.footer = footer.y;
  view.sections = sections;
  view.docH = document.documentElement.scrollHeight;
}

/** The ramp's offset: the scrim fades in from the stage bottom over SCRIM_RAMP_PX. */
function applyScrim() {
  const ramp = document.querySelector<HTMLElement>("[data-sky-scrim-ramp]");
  ramp?.style.setProperty("--scrim-d", `${scrimTop()}px`);
}

export function startView(): () => void {
  let raf = 0;
  let pending = false;
  const frame = () => {
    pending = false;
    view.y = window.scrollY;
    applyScrim();
    scrolls.forEach((l) => l());
  };
  const onScroll = () => {
    if (pending) return;
    pending = true;
    raf = requestAnimationFrame(frame);
  };
  let last = "";
  const relayout = () => {
    measure();
    applyScrim();
    // Only real layout changes reach the listeners (the iOS URL bar resizes the window, not the layout).
    const key = JSON.stringify([view.vw, view.vh, view.stage, view.hero, view.head, view.sections, view.docH]);
    if (key !== last) {
      last = key;
      geometry.forEach((l) => l());
    }
    scrolls.forEach((l) => l());
  };
  let t = 0;
  const ro = new ResizeObserver(() => {
    window.clearTimeout(t);
    t = window.setTimeout(relayout, 50);
  });
  relayout();
  ro.observe(document.body);
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", relayout);
  return () => {
    cancelAnimationFrame(raf);
    window.clearTimeout(t);
    ro.disconnect();
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", relayout);
  };
}

/** What the renderer knows that the guard can use: cloud opacity over a viewport rect (null until it runs). */
export const runtime: { cloudsIn: ((x0: number, y0: number, x1: number, y1: number) => number) | null } = { cloudsIn: null };

/** Ask the controller to re-solve the scrims (the renderer's cloud field became available or changed a lot). */
export const notifyGeometry = () => geometry.forEach((l) => l());

/** The arc's geometry from the live layout (the stage at scroll 0; a stage-sized horizon on pages without one). */
export const geomNow = (v: View = view): ArcGeom => arcGeom(v.vw, v.vh, v.stage || stageHeightFor(v.vw, v.vh), v.stage ? v.hero?.y : undefined);
