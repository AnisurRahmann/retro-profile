"use client";

import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import type { LtbData } from "./ltb-types";

/**
 * Lazy boundary for game 1. The server-rendered rack (children) stays on screen until the game chunk
 * has loaded, which only starts when the section gets near the viewport. No JS: children simply stay.
 */
export function LoadTheBarShell({ data, children }: { data: LtbData; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [Game, setGame] = useState<ComponentType<LtbData> | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let cancelled = false;
    const start = () => {
      observer.disconnect();
      void import("./LoadTheBarGame").then((module) => {
        if (!cancelled) setGame(() => module.default);
      });
    };
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) start();
      },
      { rootMargin: "1200px 0px" },
    );
    observer.observe(node);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={ref} data-ltb={Game ? "live" : "static"}>
      {Game ? <Game {...data} /> : children}
    </div>
  );
}
