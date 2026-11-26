"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { Content } from "@/content.schema";
import { animatePreview, backToNow, CANCEL_MS, minutesFromToday, setPreview, smootherstep01, stopPreviewAnimation, timeAtDrag, TIMELAPSE_MS } from "@/lib/sky/scrub";
import { liveNow, SKY_DEBUG, skyStore } from "@/lib/sky/store";
import { dhakaParts } from "@/lib/sky/time";

const TEST = process.env.NEXT_PUBLIC_E2E === "1";
const TEASER_KEY = "sky-teaser";
const IDLE_MS = 2500;
const HINT_MS = 4000;

/**
 * The sky stage: the top of the home page, full-bleed, where nothing covers the sky. The hero sits at its bottom,
 * in the column; the top is open sky.
 *
 * Drag the sky: a horizontal drag on the open sky (the stage itself or a sky placeholder, never text, links or
 * buttons) scrubs time, 1 viewport width = 12 hours; vertical swipes scroll (touch-action: pan-y).
 * First visit per session: once the stage is ≥ 60% in view and nothing has happened for 2.5 s, an 8 s time-lapse
 * from now to now + 24 h (smootherstep) and a 4 s hint. Any input cancels it (back to now in 600 ms). Skipped
 * under reduced motion, in a hidden tab and with ?sky set.
 */
export function SkyStage({
  copy,
  children,
  fallback,
}: {
  copy: Content["ui"]["sky"];
  children: React.ReactNode;
  /** The server-rendered first-paint fallback for the stage's scene (src/components/sky/SkyFallback.tsx). */
  fallback?: React.ReactNode;
}) {
  const stage = useRef<HTMLElement>(null);
  const drag = useRef<{ id: number; x0: number; y0: number; on: boolean; at: Date } | null>(null);
  const [grabbing, setGrabbing] = useState(false);
  const [hint, setHint] = useState<"" | "pointer" | "touch">("");

  const isSky = (t: EventTarget | null) => t instanceof HTMLElement && (t === stage.current || t.hasAttribute("data-sky-open"));

  const onDown = (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || !isSky(e.target)) return;
    drag.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, on: false, at: liveNow() };
  };
  const onMove = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    if (!d.on) {
      if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) {
        drag.current = null; // vertical: let it scroll
        return;
      }
      if (Math.abs(dx) <= 10 || Math.abs(dx) <= 1.5 * Math.abs(dy)) return;
      d.on = true;
      stage.current?.setPointerCapture(e.pointerId);
      setGrabbing(true);
    }
    setPreview(minutesFromToday(timeAtDrag(d.x0, e.clientX, d.at, window.innerWidth), d.at));
  };
  const onUp = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (d.on) {
      setGrabbing(false);
      backToNow();
    }
  };

  // First-visit time-lapse.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const q = new URLSearchParams(location.search);
    // Test builds arm it only with ?teaser (so it can't wander into unrelated tests).
    if ((TEST && !q.has("teaser")) || (SKY_DEBUG && q.has("sky"))) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    try {
      if (sessionStorage.getItem(TEASER_KEY)) return;
    } catch {
      return;
    }
    let visible = false;
    let idle = 0;
    let playing = false;
    let done = false;
    let hintTimer = 0;
    const touch = matchMedia("(pointer: coarse)").matches;

    const finish = () => {
      done = true;
      cleanup();
    };
    const arm = () => {
      window.clearTimeout(idle);
      if (done || playing || !visible || document.hidden) return;
      idle = window.setTimeout(play, IDLE_MS);
    };
    const play = () => {
      if (done || !visible || document.hidden) return;
      try {
        sessionStorage.setItem(TEASER_KEY, "1");
      } catch {
        /* storage off: it may play again, that's all */
      }
      playing = true;
      const from = dhakaParts(liveNow()).minutes;
      if (TEST) document.documentElement.dataset.skyTeaser = "playing";
      animatePreview(from + 1440, TIMELAPSE_MS, smootherstep01, () => {
        playing = false;
        backToNow(0);
        setHint(touch ? "touch" : "pointer");
        if (TEST) document.documentElement.dataset.skyTeaser = "done";
        hintTimer = window.setTimeout(() => setHint(""), HINT_MS);
        finish();
      }, from);
    };
    const onInput = () => {
      if (playing) {
        playing = false;
        stopPreviewAnimation();
        backToNow(CANCEL_MS);
        if (TEST) document.documentElement.dataset.skyTeaser = "cancelled";
        finish();
        return;
      }
      arm();
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = !!entry && entry.intersectionRatio >= 0.6;
        if (!visible && playing) onInput();
        else arm();
      },
      { threshold: [0, 0.6, 1] },
    );
    const events = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;
    const opts = { capture: true, passive: true };
    const onVis = () => (document.hidden ? onInput() : arm());
    function cleanup() {
      window.clearTimeout(idle);
      io.disconnect();
      events.forEach((ev) => window.removeEventListener(ev, onInput, opts));
      document.removeEventListener("visibilitychange", onVis);
    }
    io.observe(el);
    events.forEach((ev) => window.addEventListener(ev, onInput, opts));
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cleanup();
      window.clearTimeout(hintTimer);
      if (playing) {
        stopPreviewAnimation();
        skyStore.set({ preview: null, scrubbing: false });
      }
    };
  }, []);

  return (
    <section
      ref={stage}
      className="sky-stage section"
      data-sky-stage=""
      data-grabbing={grabbing ? "" : undefined}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {/* Scene mode (< 1100px): the landscape is the stage's horizon (the renderer draws into this slot). */}
      {/* The fallback is server-rendered inside the slot; the renderer appends the canvas after it, over it. */}
      <div aria-hidden="true" className="sky-scene sky-scene-stage" data-sky-scene="stage">
        {fallback}
      </div>
      <div aria-hidden="true" className="sky-stage-open" data-sky-open="" />
      <div className="column" data-sky-open="">
        <div className="relative w-fit max-w-full" data-sky-hero="">
          {children}
        </div>
      </div>
      <p aria-hidden="true" className="sky-hint" data-show={hint ? "" : undefined} data-testid="sky-hint" data-on-sky="hint">
        {hint === "touch" ? copy.hintTouch : copy.hint}
      </p>
    </section>
  );
}
