"use client";

import { useEffect } from "react";
import { countUp } from "@/lib/countup";

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
  entry?: (station: HTMLElement, later: Later) => Timeline;
  /** plays on hover, focus and tap. `hot` is the spot inside the station the pointer is on, when it has spots. */
  interact?: (station: HTMLElement, hot: HTMLElement | null) => Timeline;
  /** length of the interaction: on touch, the first tap only plays it when it is longer than TAP_HOLD */
  interactMs: number;
  /** the interaction ends in a held pose: it is dropped when the pointer or focus leaves */
  hold?: boolean;
  /** a change of state that is not motion: it also happens under reduced motion, instantly */
  swap?: (station: HTMLElement) => void;
}

/** runs something later, and never after the page has let go of the runtime */
type Later = (run: () => void, ms: number) => void;

const TAP_HOLD = 300;
const all = (root: Element, selector: string) => [...root.querySelectorAll<SVGGElement>(selector)];
const one = (root: Element, id: string) => root.querySelector<SVGGElement>(`[data-p="${id}"]`);
/** shows or hides a group for a span of time, with no tween: a held keyframe */
const hold = (node: Element | null, opacity: 0 | 1, delay: number, duration: number): Animation | null =>
  node ? node.animate({ opacity: [opacity, opacity] }, { delay, duration, fill: "none" }) : null;
const tween = (node: Element | null, keyframes: Keyframe[], options: KeyframeAnimationOptions): Animation | null => (node ? node.animate(keyframes, options) : null);
const present = (list: (Animation | null)[]): Timeline => list.filter((animation): animation is Animation => animation !== null);
const move = (x: number, y: number) => `translate(${x}px, ${y}px)`;

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

// ── A03 whiteboard ───────────────────────────────────────────
const ROW_MS = 720;
const UNDERLINE_MS = 260;

function board(station: HTMLElement) {
  const box = station.querySelector<HTMLElement>(".ill-box");
  const [restX = 0, restY = 0] = (box?.dataset.rest ?? "").split(",").map(Number);
  const spot = (cell: HTMLElement) => ({ x: Number(cell.dataset.x), y: Number(cell.dataset.y) });
  return { line: Number(box?.dataset.line ?? 0), rows: [...station.querySelectorAll<HTMLElement>("[data-wb-row]")], spot, to: (x: number, y: number) => move(x - restX, y - restY) };
}

const whiteboard: Act = {
  interactMs: UNDERLINE_MS,
  hold: true,
  // the marker runs along each row, the numbers are uncovered behind it and count up as it passes
  entry(station, later) {
    const { rows, line, spot, to } = board(station);
    const path: Keyframe[] = [];
    const timeline: (Animation | null)[] = rows.map((row, index) => {
      const cells = [...row.querySelectorAll<HTMLElement>("[data-hot]")];
      const first = spot(cells[0]!);
      const last = spot(cells[cells.length - 1]!);
      path.push({ transform: to(first.x, first.y), offset: index / rows.length }, { transform: to(last.x + line, last.y), offset: (index + 0.98) / rows.length });
      cells.forEach((cell, column) => later(() => countUp(cell, 600), index * ROW_MS + (column / cells.length) * ROW_MS));
      return row.animate({ clipPath: ["inset(0 100% 0 0)", "inset(0 0 0 0)"] }, { duration: ROW_MS, delay: index * ROW_MS, fill: "backwards", easing: "linear" });
    });
    timeline.push(tween(one(station, "marker-at"), path, { duration: ROW_MS * rows.length, easing: "linear" }));
    return present(timeline);
  },
  interact(station, hot) {
    const { line, spot, to } = board(station);
    const cells = [...station.querySelectorAll<HTMLElement>("[data-hot]")];
    const cell = hot ?? cells[0];
    const first = cells[0];
    if (!cell || !first) return [];
    const at = spot(cell);
    const home = spot(first);
    const lineAt = one(station, "line-at");
    if (lineAt) lineAt.style.transform = move(at.x - home.x, at.y - home.y);
    const options: KeyframeAnimationOptions = { duration: UNDERLINE_MS, easing: "ease-out", fill: "forwards" };
    return present([
      tween(one(station, "line"), [{ opacity: 1, transform: "scaleX(0)" }, { opacity: 1, transform: "scaleX(1)" }], options),
      tween(one(station, "marker-at"), [{ transform: to(at.x, at.y) }, { transform: to(at.x + line, at.y) }], options),
    ]);
  },
};

// ── A05 bot ──────────────────────────────────────────────────
const TALK_MS = 900;

const bot: Act = {
  interactMs: TALK_MS,
  interact(station) {
    const arcs = ["small", "medium", "large"].map((size, index) =>
      tween(one(station, `arc-${size}`), [{ opacity: 0, transform: "scale(0.6)" }, { opacity: 1, offset: 0.4 }, { opacity: 0, transform: "scale(1.2)" }], { duration: 560, delay: index * 130, easing: "ease-out" }),
    );
    return present([...arcs, hold(one(station, "head-open"), 0, 0, TALK_MS), hold(one(station, "head-closed"), 0, 0, TALK_MS), hold(one(station, "head-happy"), 1, 0, TALK_MS)]);
  },
};

// ── A06 bike ─────────────────────────────────────────────────
const RIDE_MS = 640;
const STAND_UP = 68;

const bike: Act = {
  interactMs: RIDE_MS,
  entry: (station) =>
    present([
      tween(one(station, "stand"), [{ transform: `rotate(${-STAND_UP}deg)` }, { transform: "rotate(6deg)", offset: 0.8 }, { transform: "rotate(0deg)" }], { duration: 260, delay: 240, easing: "ease-out", fill: "backwards" }),
    ]),
  interact(station) {
    const spin: KeyframeAnimationOptions = { duration: RIDE_MS, easing: "ease-in-out" };
    const lines = all(station, '[data-p^="speed-"]').map((line, index) =>
      line.animate([{ opacity: 0, transform: "translateX(60px)" }, { opacity: 1, offset: 0.4 }, { opacity: 0, transform: "translateX(-70px)" }], { duration: 360, delay: 80 + index * 70, easing: "ease-out" }),
    );
    return present([
      tween(one(station, "wheel-rear"), [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }], spin),
      tween(one(station, "wheel-front"), [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }], spin),
      tween(one(station, "bike"), [{ transform: "translateX(0)" }, { transform: "translateX(6px)" }, { transform: "translateX(0)" }], spin),
      ...lines,
    ]);
  },
};

// ── A07 chalk and logbook ────────────────────────────────────
const CHALK_BURST_MS = 700;

const chalk: Act = {
  interactMs: CHALK_BURST_MS,
  interact(station) {
    const puffs = all(station, '[data-p^="puff-"]').map((puff, index) => {
      const drift = (index - 2) * 14;
      return puff.animate(
        [
          { opacity: 0, transform: "translate(0, 24px) scale(0.3)" },
          { opacity: 1, transform: `translate(${drift * 0.6}px, -14px) scale(1)`, offset: 0.35 },
          { opacity: 0, transform: `translate(${drift}px, 6px) scale(1.05)` },
        ],
        { duration: CHALK_BURST_MS - index * 40, delay: index * 40, easing: "ease-out" },
      );
    });
    return present([
      ...puffs,
      tween(one(station, "page"), [{ opacity: 1, transform: "scaleX(1)" }, { opacity: 1, transform: "scaleX(-1)", offset: 0.9 }, { opacity: 0, transform: "scaleX(-1)" }], { duration: 560, delay: 80, easing: "ease-in-out" }),
    ]);
  },
};

// ── A08 calendar ─────────────────────────────────────────────
const TEAR_MS = 700;

const calendar: Act = {
  interactMs: TEAR_MS,
  // the next goal, wrapping at the end. The torn page falls away over it.
  swap(station) {
    const goals = [...station.querySelectorAll<HTMLElement>("[data-goal]")];
    const current = goals.findIndex((goal) => !goal.hidden);
    goals.forEach((goal, index) => (goal.hidden = index !== (current + 1) % goals.length));
  },
  interact: (station) =>
    present([
      tween(
        one(station, "tear"),
        [
          { opacity: 1, transform: "translateY(0) rotate(0deg)" },
          { opacity: 1, transform: "translateY(70px) rotate(7deg)", offset: 0.45 },
          { opacity: 0, transform: "translateY(260px) rotate(20deg)" },
        ],
        { duration: TEAR_MS, easing: "ease-in" },
      ),
    ]),
};

// ── A09 miss bin ─────────────────────────────────────────────
const THROW_MS = 760;
const THROW_HEIGHT = 190;

const bin: Act = {
  interactMs: THROW_MS,
  interact(station) {
    const [dx = 0, dy = 0] = (station.querySelector<HTMLElement>(".ill-box")?.dataset.throw ?? "").split(",").map(Number);
    // a parabola from the floor to the mouth of the bin, then down behind its wall
    const flight: Keyframe[] = [0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => ({
      opacity: 1,
      transform: `${move(Math.round(dx * t), Math.round(dy * t - 4 * THROW_HEIGHT * t * (1 - t)))} rotate(${Math.round(t * 300)}deg)`,
      offset: t * 0.7,
    }));
    return present([
      tween(
        one(station, "ball"),
        [...flight, { opacity: 1, transform: `${move(dx, dy + 150)} rotate(340deg)`, offset: 0.84 }, { opacity: 0, transform: `${move(dx, dy + 150)} rotate(340deg)`, offset: 0.85 }, { opacity: 0, transform: "none", offset: 0.9 }, { opacity: 1, transform: "none" }],
        { duration: THROW_MS, easing: "linear" },
      ),
    ]);
  },
};

// ── A10 phone ────────────────────────────────────────────────
const LIFT_MS = 180;

const phone: Act = {
  interactMs: LIFT_MS,
  hold: true,
  interact: (station) => present([tween(one(station, "handset"), [{ transform: "translateY(0) rotate(0deg)" }, { transform: "translateY(-46px) rotate(-10deg)" }], { duration: LIFT_MS, easing: "ease-out", fill: "forwards" })]),
};

// ── A11 gym kit ──────────────────────────────────────────────
const SWING_MS = 820;

const kit: Act = {
  interactMs: SWING_MS,
  interact: (station) =>
    present([tween(one(station, "bell-blue"), [0, 9, -7, 4, -2, 0].map((turn) => ({ transform: `rotate(${turn}deg)` })), { duration: SWING_MS, easing: "ease-in-out" })]),
};

// ── A12 lamp ─────────────────────────────────────────────────
const PULL_MS = 280;

const lamp: Act = {
  interactMs: PULL_MS,
  interact: (station) =>
    present([tween(one(station, "cord"), [{ transform: "translateY(0)" }, { transform: "translateY(20px)", offset: 0.35 }, { transform: "translateY(-5px)", offset: 0.75 }, { transform: "translateY(0)" }], { duration: PULL_MS, easing: "ease-out" })]),
};

const ACTS: Record<string, Act> = { rack, character, whiteboard, bot, bike, chalk, calendar, bin, phone, kit, lamp };

export function GarageRuntime() {
  useEffect(() => {
    const room = document.querySelector<HTMLElement>("[data-garage]");
    if (!room) return;
    const stations = [...room.querySelectorAll<HTMLElement>("[data-station]")];
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const timelines = new Map<HTMLElement, { kind: "entry" | "interact"; list: Timeline }>();
    const timers = new Set<number>();
    const later: Later = (run, ms) => {
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        run();
      }, ms);
      timers.add(timer);
    };
    const botStation = stations.find((station) => station.dataset.station === "bot") ?? null;
    const say = room.querySelector<HTMLElement>("[data-say]");
    const entered = new WeakSet<HTMLElement>();
    let armed: HTMLElement | null = null;
    let lastPointer = "mouse";

    const cancel = (station: HTMLElement) => {
      timelines.get(station)?.list.forEach((animation) => animation.cancel());
      timelines.delete(station);
    };
    const play = (station: HTMLElement, kind: "entry" | "interact", hot: HTMLElement | null = null) => {
      const act = ACTS[station.dataset.station ?? ""];
      if (!act?.[kind] || reduced.matches || typeof station.animate !== "function") return;
      // an entry in flight is not interrupted by a passing pointer, and an interaction only restarts for a new spot
      const playing = timelines.get(station);
      if (kind === "interact" && playing?.list.some((animation) => animation.playState === "running") && (playing.kind === "entry" || !hot)) return;
      cancel(station);
      timelines.set(station, { kind, list: kind === "entry" ? act.entry!(station, later) : act.interact!(station, hot) });
    };
    // the bot speaks the plain label of whatever is in focus
    const speak = (station: HTMLElement | null) => {
      const text = station?.querySelector(".station-label .plain")?.textContent ?? "";
      if (say) say.textContent = text;
      botStation?.toggleAttribute("data-speaking", text !== "");
      if (station && botStation && station !== botStation) play(botStation, "interact");
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
    const hotOf = (target: EventTarget | null) => (target instanceof Element ? target.closest<HTMLElement>("[data-hot]") : null);
    const activate = (station: HTMLElement, hot: HTMLElement | null = null) => {
      const fresh = !station.hasAttribute("data-active");
      station.setAttribute("data-active", "");
      if (fresh) ACTS[station.dataset.station ?? ""]?.swap?.(station);
      play(station, "interact", hot);
      speak(station);
    };
    const release = (station: HTMLElement) => {
      station.removeAttribute("data-active");
      if (ACTS[station.dataset.station ?? ""]?.hold && timelines.get(station)?.kind === "interact") cancel(station);
      speak(room.querySelector<HTMLElement>("[data-station][data-active]"));
    };
    const onOver = (event: PointerEvent) => {
      const station = stationOf(event.target);
      if (!station || event.pointerType !== "mouse") return;
      const hot = hotOf(event.target);
      // moving inside a station only counts when the pointer reaches a new spot (a number on the whiteboard)
      if (station.contains(event.relatedTarget as Node | null) && (!hot || hot === hotOf(event.relatedTarget))) return;
      activate(station, hot);
    };
    const onOut = (event: PointerEvent) => {
      const station = stationOf(event.target);
      if (!station || station.contains(event.relatedTarget as Node | null)) return;
      if (!station.contains(document.activeElement)) release(station);
    };
    const onFocusIn = (event: FocusEvent) => {
      const station = stationOf(event.target);
      if (station && (event.target as Element).matches(":focus-visible")) activate(station);
    };
    const onFocusOut = (event: FocusEvent) => {
      const station = stationOf(event.target);
      if (station) release(station);
      if (station === armed) armed = null;
    };
    const onDown = (event: PointerEvent) => {
      lastPointer = event.pointerType;
    };
    // touch: the first tap plays a long interaction, the second follows the link. Short ones navigate at once.
    const onClick = (event: MouseEvent) => {
      const station = stationOf(event.target);
      if (!station) return;
      // the lamp is a control, not a link: every pull of the cord plays
      if (!station.matches("a")) {
        if ((event.target as Element).closest("button")) play(station, "interact");
        return;
      }
      if (lastPointer !== "touch" || reduced.matches) return;
      const act = ACTS[station.dataset.station ?? ""];
      if (!act?.interact) return;
      if (act.interactMs <= TAP_HOLD) {
        play(station, "interact");
        return;
      }
      if (armed === station) return;
      event.preventDefault();
      if (armed) release(armed);
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
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  return null;
}
