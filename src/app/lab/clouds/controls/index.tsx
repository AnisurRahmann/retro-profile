"use client";

import type { LabState, VolRenderer } from "@/components/sky/volumetric/types";

export type ControlsProps = {
  /** The state parsed from the URL on load. */
  initial: LabState;
  /** Null until the renderer has started (or if it failed). */
  renderer: VolRenderer | null;
};

/**
 * The lab's controls panel (owner T3): every LabState field, presets A–C, the frame-time readout. Each change goes
 * to renderer.setState and history.replaceState(serialiseLabState). PLACEHOLDER (T0): an empty panel.
 */
export function Controls({ initial, renderer }: ControlsProps) {
  void initial;
  void renderer;
  return <aside aria-label="Lab controls" className="fixed top-3 right-3 z-10" data-vol-controls="" />;
}
