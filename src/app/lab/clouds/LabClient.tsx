"use client";

import { useEffect, useRef, useState } from "react";
import { startRenderer } from "@/components/sky/volumetric/renderer";
import { outputFor } from "@/components/sky/volumetric/targets";
import type { LabState, VolRenderer } from "@/components/sky/volumetric/types";
import { parseLabState } from "@/lib/sky/volumetric/lab-state";
import { Controls } from "./controls";

/**
 * The lab shell (owner T0; T11's layered output): a full-viewport canvas, the debug overlay and the controls panel
 * (T3). With out=layered a second canvas, the background layer, sits under the (then transparent) cloud canvas.
 */
export function LabClient() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const bg = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const [initial, setInitial] = useState<LabState | null>(null);
  const [renderer, setRenderer] = useState<VolRenderer | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s = parseLabState(window.location.search);
    // The background canvas is always in the page; it only gets a context with the layered output (the default, T11),
    // and the opaque single-mode canvas covers it otherwise.
    const layered = outputFor(s).mode === "layered";
    let r: VolRenderer | null = null;
    let gone = false;
    startRenderer(canvas.current!, s, { overlay: overlay.current, background: layered ? bg.current : null })
      .then((x) => {
        if (gone) return x.dispose();
        setInitial(s);
        setRenderer((r = x));
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        setInitial(s);
        setError(msg);
        window.__vol = { frames: 0, ready: false, tier: "low", gpuMs: null, times: [], state: s, noiseMs: 0, error: msg, accumReady: false, out: "single", bgGpuMs: null, bgDrawMs: [] };
      });
    return () => {
      gone = true;
      r?.dispose();
    };
  }, []);

  return (
    <div className="vol-lab fixed inset-0 z-50 bg-ink" data-vol-lab="">
      <canvas ref={bg} className="absolute inset-0 block h-full w-full" data-vol-bg-canvas="" aria-hidden="true" />
      <canvas ref={canvas} className="relative block h-full w-full" data-vol-canvas="" aria-hidden="true" />
      <div ref={overlay} className="pointer-events-none absolute inset-0 [&>*]:pointer-events-auto" data-vol-overlay="" />
      {error && (
        <p role="alert" className="absolute bottom-4 left-4 font-mono text-xs text-text">
          {error}
        </p>
      )}
      {initial && <Controls initial={initial} renderer={renderer} />}
    </div>
  );
}
