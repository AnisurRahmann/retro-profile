"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";

/**
 * Lazy boundaries. next/dynamic only code-splits when called from a Client Component.
 * - SystemMap is still server-rendered, so the map is in the static HTML.
 * - HeroCanvas is client only: the static SVG trace is the server-rendered fallback.
 */
export const SystemMapLazy = dynamic(() => import("./SystemMap"));

const HeroCanvas = dynamic(() => import("./HeroCanvas"), { ssr: false });

const QUERY = "(prefers-reduced-motion: reduce)";
function subscribeMotion(cb: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/** Mounts the animated canvas unless the user prefers reduced motion. */
export function HeroTraceLive() {
  const animate = useSyncExternalStore(
    subscribeMotion,
    () => !window.matchMedia(QUERY).matches,
    () => false,
  );
  return animate ? <HeroCanvas /> : null;
}
