"use client";

import { useEffect } from "react";

/**
 * The garage animation runtime: one small client module, no library, no content import.
 * It finds stations by data attributes. Everything already renders in its final pose without it.
 *
 * - entry sequences run once per page load, when 40% of a station is on screen
 * - hover, keyboard focus and tap play the same interaction
 * - sequenced motion is Web Animations, one cancellable timeline per station; idle loops are CSS
 * - idle loops pause when the tab is hidden or the station is off screen
 * - reduced motion: no sequences at all, CSS swaps the state instantly while a station is active
 */

type Timeline = Animation[];

interface Act {
  /** plays once when the station scrolls into view */
  entry?: (station: HTMLElement) => Timeline;
  /** plays on hover, focus and tap */
  interact?: (station: HTMLElement) => Timeline;
  /** length of the interaction: on touch, the first tap only plays it when it is longer than TAP_HOLD */
  interactMs: number;
}

const TAP_HOLD = 300;
const all = (root: Element, selector: string) => [...root.querySelectorAll<SVGGElement>(selector)];
/** shows or hides a group for a span of time, with no tween: a held keyframe */
const hold = (node: Element | null, opacity: 0 | 1, delay: number, duration: number): Animation | null =>
  node ? node.animate({ opacity: [opacity, opacity] }, { delay, duration, fill: "none" }) : null;
const present = (list: (Animation | null)[]): Timeline => list.filter((animation): animation is Animation => animation !== null);

// ── A02 rack ─────────────────────────────────────────────────
const PLATE_START = 120;
const PLATE_MS = 220;
const PLATE_STAGGER = 90;
const OVERSHOOT = 3;
const DIP_MS = 180;
const RATTLE_MS = 240;
const BOW_MS = 160;

const rack: Act = {
  interactMs: RATTLE_MS,
  entry(station) {
    const plates = all(station, '[data-rk="plate"]');
    const timeline = plates.map((plate) => {
      const out = plate.dataset.side === "l" ? -1 : 1;
      const index = Number(plate.style.getPropertyValue("--i"));
      return plate.animate(
        [
          { transform: `translateX(${out * PLATE_START}px)`, opacity: 0 },
          { opacity: 1, offset: 0.25 },
          { transform: `translateX(${-out * OVERSHOOT}px)`, opacity: 1, offset: 0.82 },
          { transform: "translateX(0)", opacity: 1 },
        ],
        { duration: PLATE_MS, delay: index * PLATE_STAGGER, easing: "ease-out", fill: "backwards" },
      );
    });
    const last = Math.max(0, ...plates.map((plate) => Number(plate.style.getPropertyValue("--i")))) * PLATE_STAGGER + PLATE_MS;
    const load = station.querySelector('[data-rk="load"]');
    if (load) {
      timeline.push(load.animate([{ transform: "translateY(0)" }, { transform: "translateY(4px)" }, { transform: "translateY(0)" }], { duration: DIP_MS, delay: last, easing: "ease-in-out" }));
    }
    return timeline;
  },
  interact(station) {
    const rattle = all(station, '[data-rk="plate"]').map((plate, index) => {
      const turn = index % 2 === 0 ? 1.2 : -1.2;
      return plate.animate([{ transform: "rotate(0deg)" }, { transform: `rotate(${turn}deg)` }, { transform: `rotate(${-turn}deg)` }, { transform: "rotate(0deg)" }], { duration: RATTLE_MS, easing: "ease-in-out" });
    });
    return present([...rattle, hold(station.querySelector('[data-rk="straight"]'), 0, 0, BOW_MS), hold(station.querySelector('[data-rk="bowed"]'), 1, 0, BOW_MS)]);
  },
};

// ── A01 character (whole poses, swapped) ─────────────────────
const WAVE_MS = 900;
const CHALK_MS = 520;
const PUFF_MS = 620;

function poses(station: HTMLElement, sequence: [pose: "wave" | "chalk", ms: number][]): Timeline {
  const total = sequence.reduce((sum, [, ms]) => sum + ms, 0);
  const timeline: (Animation | null)[] = [hold(station.querySelector('[data-ch="idle"]'), 0, 0, total)];
  let at = 0;
  for (const [pose, ms] of sequence) {
    timeline.push(hold(station.querySelector(`[data-ch="${pose}"]`), 1, at, ms));
    if (pose === "chalk") {
      const puffs = station.querySelector('[data-ch="puffs"]');
      if (puffs) {
        timeline.push(puffs.animate([{ opacity: 1, transform: "translateY(0)" }, { opacity: 0, transform: "translateY(-16px)" }], { delay: at, duration: PUFF_MS, easing: "ease-out" }));
      }
    }
    at += ms;
  }
  return present(timeline);
}

const character: Act = {
  interactMs: WAVE_MS,
  entry: (station) =>
    poses(station, [
      ["wave", WAVE_MS],
      ["chalk", CHALK_MS],
    ]),
  interact: (station) => poses(station, [["wave", WAVE_MS]]),
};

const ACTS: Record<string, Act> = { rack, character };

export function GarageRuntime() {
  useEffect(() => {
    const room = document.querySelector<HTMLElement>("[data-garage]");
    if (!room) return;
    const stations = [...room.querySelectorAll<HTMLElement>("[data-station]")];
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const timelines = new Map<HTMLElement, Timeline>();
    const entered = new WeakSet<HTMLElement>();
    let armed: HTMLElement | null = null;
    let lastPointer = "mouse";

    const cancel = (station: HTMLElement) => {
      timelines.get(station)?.forEach((animation) => animation.cancel());
      timelines.delete(station);
    };
    const play = (station: HTMLElement, kind: "entry" | "interact") => {
      const act = ACTS[station.dataset.station ?? ""];
      const sequence = act?.[kind];
      if (!sequence || reduced.matches || typeof station.animate !== "function") return;
      // an entry in flight is not interrupted by a passing pointer
      if (kind === "interact" && timelines.get(station)?.some((animation) => animation.playState === "running")) return;
      cancel(station);
      timelines.set(station, sequence(station));
    };

    // entry, once, at 40% visibility. data-entered also lifts the CSS that keeps the plates off the bar until then.
    const enter = (station: HTMLElement) => {
      if (entered.has(station)) return;
      entered.add(station);
      station.setAttribute("data-entered", "");
      play(station, "entry");
    };
    // off screen stations pause their CSS idle loops
    let entryObserver: IntersectionObserver | null = null;
    let screenObserver: IntersectionObserver | null = null;
    if ("IntersectionObserver" in window) {
      entryObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entryObserver?.unobserve(entry.target);
            enter(entry.target as HTMLElement);
          }
        },
        { threshold: 0.4 },
      );
      screenObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) entry.target.toggleAttribute("data-onscreen", entry.isIntersecting);
      });
      for (const station of stations) {
        entryObserver.observe(station);
        screenObserver.observe(station);
      }
    } else {
      for (const station of stations) {
        station.setAttribute("data-onscreen", "");
        enter(station);
      }
    }

    const onVisibility = () => document.documentElement.toggleAttribute("data-tab-hidden", document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    onVisibility();

    const stationOf = (target: EventTarget | null) => (target instanceof Element ? target.closest<HTMLElement>("[data-station]") : null);
    const activate = (station: HTMLElement) => {
      station.setAttribute("data-active", "");
      play(station, "interact");
    };
    const onOver = (event: PointerEvent) => {
      const station = stationOf(event.target);
      if (!station || event.pointerType !== "mouse" || station.contains(event.relatedTarget as Node | null)) return;
      activate(station);
    };
    const onOut = (event: PointerEvent) => {
      const station = stationOf(event.target);
      if (!station || station.contains(event.relatedTarget as Node | null)) return;
      if (station !== document.activeElement) station.removeAttribute("data-active");
    };
    const onFocusIn = (event: FocusEvent) => {
      const station = stationOf(event.target);
      if (station?.matches(":focus-visible")) activate(station);
    };
    const onFocusOut = (event: FocusEvent) => {
      const station = stationOf(event.target);
      station?.removeAttribute("data-active");
      if (station === armed) armed = null;
    };
    const onDown = (event: PointerEvent) => {
      lastPointer = event.pointerType;
    };
    // touch: the first tap plays a long interaction, the second follows the link. Short ones navigate at once.
    const onClick = (event: MouseEvent) => {
      const station = stationOf(event.target);
      if (!station || lastPointer !== "touch" || reduced.matches) return;
      const act = ACTS[station.dataset.station ?? ""];
      if (!act?.interact) return;
      if (act.interactMs <= TAP_HOLD) {
        play(station, "interact");
        return;
      }
      if (armed === station) return;
      event.preventDefault();
      armed?.removeAttribute("data-active");
      armed = station;
      activate(station);
    };
    room.addEventListener("pointerover", onOver);
    room.addEventListener("pointerout", onOut);
    room.addEventListener("focusin", onFocusIn);
    room.addEventListener("focusout", onFocusOut);
    room.addEventListener("pointerdown", onDown);
    room.addEventListener("click", onClick);

    return () => {
      entryObserver?.disconnect();
      screenObserver?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      room.removeEventListener("pointerover", onOver);
      room.removeEventListener("pointerout", onOut);
      room.removeEventListener("focusin", onFocusIn);
      room.removeEventListener("focusout", onFocusOut);
      room.removeEventListener("pointerdown", onDown);
      room.removeEventListener("click", onClick);
      stations.forEach(cancel);
    };
  }, []);

  return null;
}
