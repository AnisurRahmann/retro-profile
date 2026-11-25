/**
 * Time travel: drag the sky, the sun-path strip and the first-visit time-lapse all set `preview` (minutes past
 * today's Dhaka midnight, any real number: beyond 1440 is tomorrow) and animate back to now when let go.
 */
import { dhakaParts } from "./time";
import { liveNow, skyStore } from "./store";

const HOUR = 3600_000;
/** Dragging the sky: one viewport width = 12 hours. */
export const DRAG_HOURS_PER_WIDTH = 12;
export const BACK_MS = 1600;
export const CANCEL_MS = 600;
export const TIMELAPSE_MS = 8000;
export const LAST_MINUTE = 24 * 60 - 5;

/** The time a horizontal drag from x0 to x shows: forward to the right, 12 h per viewport width. */
export function timeAtDrag(x0: number, x: number, now: Date, viewportW: number): Date {
  return new Date(now.getTime() + ((x - x0) / Math.max(1, viewportW)) * DRAG_HOURS_PER_WIDTH * HOUR);
}

export const easeInOutCubic = (t: number) => {
  const k = Math.min(1, Math.max(0, t));
  return k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
};

export const smootherstep01 = (t: number) => {
  const k = Math.min(1, Math.max(0, t));
  return k * k * k * (k * (k * 6 - 15) + 10);
};

/** Minutes past the Dhaka midnight of `now` for an instant (negative = yesterday, ≥ 1440 = tomorrow). */
export function minutesFromToday(at: Date, now: Date): number {
  const p = dhakaParts(now);
  return p.minutes + (at.getTime() - now.getTime()) / 60_000;
}

/** "HH:mm" for preview minutes (wraps across midnight). */
export const minutesLabel = (m: number) => {
  const r = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${String(Math.floor(r / 60)).padStart(2, "0")}:${String(r % 60).padStart(2, "0")}`;
};

let anim = 0;
let animEnd: (() => void) | null = null;

/** Stop any running preview animation (the caller takes over). */
export function stopPreviewAnimation() {
  cancelAnimationFrame(anim);
  anim = 0;
  animEnd = null;
}

export function setPreview(minutes: number) {
  stopPreviewAnimation();
  skyStore.set({ preview: minutes, scrubbing: true });
}

const reduced = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Animate `preview` from its current value to `to` over `ms` with `ease`, then call `done`. Instant under
 * reduced motion.
 */
export function animatePreview(to: number, ms: number, ease: (t: number) => number, done?: () => void, from?: number) {
  stopPreviewAnimation();
  const start = from ?? skyStore.get().preview;
  if (start === null || reduced() || ms <= 0) {
    skyStore.set({ preview: to, scrubbing: true });
    done?.();
    return;
  }
  const t0 = performance.now();
  animEnd = done ?? null;
  const step = () => {
    const k = Math.min(1, (performance.now() - t0) / ms);
    skyStore.set({ preview: start + (to - start) * ease(k), scrubbing: true });
    if (k < 1) anim = requestAnimationFrame(step);
    else {
      anim = 0;
      const end = animEnd;
      animEnd = null;
      end?.();
    }
  };
  anim = requestAnimationFrame(step);
}

/** Let go: the sky eases back to now (1.6 s ease-in-out cubic by default), then goes live. */
export function backToNow(ms = BACK_MS, ease = easeInOutCubic) {
  const s = skyStore.get();
  if (s.preview === null) {
    if (s.scrubbing) skyStore.set({ scrubbing: false });
    return;
  }
  const now = dhakaParts(liveNow()).minutes;
  // Take the short way round when the preview has wrapped past a whole day (the time-lapse ends at now + 24 h).
  const from = s.preview - Math.round((s.preview - now) / 1440) * 1440;
  animatePreview(now, ms, ease, () => skyStore.set({ preview: null, scrubbing: false }), from);
}
