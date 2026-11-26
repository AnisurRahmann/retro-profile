"use client";

import { useEffect, useRef, useState } from "react";
import { startRenderer } from "@/components/sky/volumetric/renderer";
import type { LabState, VolRenderer } from "@/components/sky/volumetric/types";
import { parseLabState } from "@/lib/sky/volumetric/lab-state";
import { Controls } from "./controls";

/** The lab shell (owner T0): a full-viewport canvas, the debug overlay and the controls panel (T3). */
export function LabClient() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const [initial, setInitial] = useState<LabState | null>(null);
  const [renderer, setRenderer] = useState<VolRenderer | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s = parseLabState(window.location.search);
    let r: VolRenderer | null = null;
    let gone = false;
    startRenderer(canvas.current!, s, { overlay: overlay.current })
      .then((x) => {
        if (gone) return x.dispose();
        setInitial(s);
        setRenderer((r = x));
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        setInitial(s);
        setError(msg);
        window.__vol = { frames: 0, ready: false, tier: "low", gpuMs: null, times: [], state: s, noiseMs: 0, error: msg };
      });
    return () => {
      gone = true;
      r?.dispose();
    };
  }, []);

  return (
    <div className="vol-lab fixed inset-0 z-50 bg-ink" data-vol-lab="">
      <canvas ref={canvas} className="block h-full w-full" data-vol-canvas="" aria-hidden="true" />
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
