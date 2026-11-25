"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const SkyRenderer = dynamic(() => import("./SkyRenderer"), { ssr: false });

/** Loads the canvas renderer once the main thread is idle. Until then (and without JS) the CSS gradient is the sky. */
export function SkyMount() {
  const [go, setGo] = useState(false);
  useEffect(() => {
    const idle = "requestIdleCallback" in window;
    const id = idle ? window.requestIdleCallback(() => setGo(true), { timeout: 2000 }) : window.setTimeout(() => setGo(true), 200);
    return () => (idle ? window.cancelIdleCallback(id) : window.clearTimeout(id));
  }, []);
  return go ? <SkyRenderer /> : null;
}
