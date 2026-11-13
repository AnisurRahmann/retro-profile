"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { LoadTheBarView, type LtbHandlers } from "./LoadTheBarView";
import type { LtbData } from "./ltb-types";

const STORE_KEY = "ltb-loaded";
const GOODLIFT_KEY = "ltb-goodlift";
const DRAG_THRESHOLD = 6;

type Drag = { id: string; pointerId: number; x: number; y: number; active: boolean; ghost: HTMLElement | null; size: number };

function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

function readStore(valid: Set<string>): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) ?? "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    return [...new Set(raw.filter((id): id is string => typeof id === "string" && valid.has(id)))];
  } catch {
    return [];
  }
}

export default function LoadTheBarGame(data: LtbData) {
  const { plates, shippedIds, copy } = data;
  const [loaded, setLoaded] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [goodLift, setGoodLift] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [instant, setInstant] = useState(true);
  const dropRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const loadedRef = useRef<string[]>([]);

  const name = useCallback((id: string) => plates.find((plate) => plate.id === id)?.name ?? id, [plates]);

  // restore the bar once, after mount (never during render, so server and client markup agree)
  useEffect(() => {
    const restored = readStore(new Set(plates.map((plate) => plate.id)));
    if (restored.length > 0) {
      loadedRef.current = restored;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from localStorage
      setLoaded(restored);
      setSelected(restored[restored.length - 1] ?? null);
    }
    const frame = requestAnimationFrame(() => setInstant(false));
    return () => cancelAnimationFrame(frame);
  }, [plates]);

  const commit = useCallback((next: string[]) => {
    loadedRef.current = next;
    setLoaded(next);
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(next));
    } catch {
      // storage unavailable: the bar still works for this visit
    }
  }, []);

  const load = useCallback(
    (id: string) => {
      const before = loadedRef.current;
      setSelected(id);
      if (before.includes(id)) return;
      const next = [...before, id];
      commit(next);
      setAnnouncement(fill(copy.announceLoaded, { name: name(id), n: next.length, total: plates.length }));
      if (shippedIds.length > 0 && shippedIds.every((shipped) => next.includes(shipped))) {
        let seen = false;
        try {
          seen = localStorage.getItem(GOODLIFT_KEY) === "1";
          localStorage.setItem(GOODLIFT_KEY, "1");
        } catch {
          // ignore
        }
        if (!seen) setGoodLift(true);
      }
    },
    [commit, copy.announceLoaded, name, plates.length, shippedIds],
  );

  const unload = useCallback(
    (id: string) => {
      const next = loadedRef.current.filter((entry) => entry !== id);
      commit(next);
      setAnnouncement(fill(copy.announceUnloaded, { name: name(id), n: next.length, total: plates.length }));
    },
    [commit, copy.announceUnloaded, name, plates.length],
  );

  const strip = useCallback(() => {
    commit([]);
    setSelected(null);
    setGoodLift(false);
    setAnnouncement(fill(copy.announceStripped, { total: plates.length }));
  }, [commit, copy.announceStripped, plates.length]);

  const endDrag = useCallback(() => {
    drag.current?.ghost?.remove();
    drag.current = null;
    setOver(false);
  }, []);

  useEffect(() => endDrag, [endDrag]);

  const isOverBar = (x: number, y: number) => {
    const rect = dropRef.current?.getBoundingClientRect();
    return !!rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  };

  const handlers: LtbHandlers = {
    onPlate: (id) => {
      if (suppressClick.current) return;
      load(id);
    },
    onSelect: setSelected,
    onUnload: unload,
    onStrip: strip,
    onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>, id) => {
      if (event.button !== 0) return;
      const rect = event.currentTarget.getBoundingClientRect();
      drag.current = { id, pointerId: event.pointerId, x: event.clientX, y: event.clientY, active: false, ghost: null, size: rect.width };
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // capture is a nicety, dragging still works without it
      }
    },
    onPointerMove: (event) => {
      const state = drag.current;
      if (!state || state.pointerId !== event.pointerId) return;
      if (!state.active) {
        if (Math.hypot(event.clientX - state.x, event.clientY - state.y) < DRAG_THRESHOLD) return;
        state.active = true;
        const ghost = event.currentTarget.cloneNode(true) as HTMLElement;
        ghost.classList.add("drag-ghost");
        ghost.removeAttribute("data-plate-id");
        ghost.setAttribute("aria-hidden", "true");
        document.body.appendChild(ghost);
        state.ghost = ghost;
      }
      if (state.ghost) {
        const half = state.size / 2;
        state.ghost.style.transform = `translate(${event.clientX - half}px, ${event.clientY - half}px)`;
      }
      const nowOver = isOverBar(event.clientX, event.clientY);
      setOver((previous) => (previous === nowOver ? previous : nowOver));
    },
    onPointerUp: (event) => {
      const state = drag.current;
      if (!state || state.pointerId !== event.pointerId) return;
      const wasDrag = state.active;
      const dropped = wasDrag && isOverBar(event.clientX, event.clientY);
      const id = state.id;
      endDrag();
      if (wasDrag) {
        // a drag is not a click: swallow the click that follows pointerup
        suppressClick.current = true;
        setTimeout(() => {
          suppressClick.current = false;
        }, 0);
        if (dropped) load(id);
      }
    },
    onPointerCancel: () => endDrag(),
  };

  return (
    <LoadTheBarView
      {...data}
      loaded={loaded}
      selected={selected}
      over={over}
      goodLift={goodLift}
      announcement={announcement}
      instant={instant}
      dropRef={dropRef}
      handlers={handlers}
    />
  );
}
