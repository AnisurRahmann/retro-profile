"use client";

import { useEffect, useRef, useState } from "react";

const CYCLE_MS = 3200;
const LEAVE_MS = 180;
const CHAR_MS = 18;
const MAX_TYPE_MS = 600;

/**
 * Rotating status line. The first line is server-rendered (no layout shift);
 * height is reserved by CSS. Under reduced motion: one line per page load, no cycling.
 */
export function StatusLine({ lines }: { lines: string[] }) {
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState<number | null>(null); // chars revealed; null = all
  const [leaving, setLeaving] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time pick after hydration
      setIndex(Math.floor(Math.random() * lines.length));
      return;
    }

    const clear = () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };
    const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));

    let current = 0;
    const tick = () => {
      setLeaving(true);
      later(() => {
        current = (current + 1) % lines.length;
        const text = lines[current] ?? "";
        const step = Math.min(CHAR_MS, MAX_TYPE_MS / Math.max(text.length, 1));
        setIndex(current);
        setShown(0);
        setLeaving(false);
        for (let c = 1; c <= text.length; c++) later(() => setShown(c), Math.round(c * step));
        later(() => setShown(null), Math.round(text.length * step) + 20);
        later(tick, CYCLE_MS);
      }, LEAVE_MS);
    };

    const start = () => {
      clear();
      later(tick, CYCLE_MS);
    };
    const onVisibility = () => {
      if (document.hidden) {
        clear();
        setLeaving(false);
        setShown(null);
      } else start();
    };

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clear();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [lines]);

  const text = lines[index] ?? "";
  const visible = shown === null ? text : text.slice(0, shown);
  const hidden = shown === null ? "" : text.slice(shown);

  return (
    <span className="status-line" data-leaving={leaving} data-testid="status-line">
      {visible}
      {hidden ? (
        <span aria-hidden="true" className="invisible">
          {hidden}
        </span>
      ) : null}
    </span>
  );
}
