"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  LAB_PRESETS,
  SHADER_DEBUG_VIEWS,
  TIERS,
  type CloudAtSun,
  type CloudType,
  type FrameTime,
  type LabState,
  type QualityTier,
  type VolRenderer,
} from "@/components/sky/volumetric/types";
import { moon as moonAt, sun as sunAt } from "@/lib/sky/astro";
import { outputFor } from "@/components/sky/volumetric/targets";
import { ACCUM_MAX, SCALE_RANGE, SOUT_RANGE, presetState, serialiseLabState } from "@/lib/sky/volumetric/lab-state";
import { labDate } from "@/lib/sky/volumetric/scene";
import { DateField, FrameReadout, NumField, Section, Seg, SelectField, Slider, Toggle } from "./widgets";

export type ControlsProps = {
  /** The state parsed from the URL on load. */
  initial: LabState;
  /** Null until the renderer has started (or if it failed). */
  renderer: VolRenderer | null;
};

/** Collapsed by default so the T6/T8 review shots keep a clean corner; remembered for the session. */
const OPEN_KEY = "vol-controls-open";

const WIND_POINTS: { value: number; text: string; title: string }[] = [
  { value: 0, text: "N", title: "north" },
  { value: 45, text: "NE", title: "north-east" },
  { value: 90, text: "E", title: "east" },
  { value: 135, text: "SE", title: "south-east" },
  { value: 180, text: "S", title: "south" },
  { value: 225, text: "SW", title: "south-west" },
  { value: 270, text: "W", title: "west" },
  { value: 315, text: "NW", title: "north-west" },
];

const hm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const minutesOf = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const deg = (v: number) => `${Math.round(v)}°`;
const signedDeg = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}°`;

/**
 * The lab's controls panel (owner T3): every LabState field, presets A–C and the frame-time readout. Each change
 * goes through commit(): React state at once, then one renderer.setState + history.replaceState per frame (T7:
 * every setState drops the reprojection history, so slider drags must not spam it).
 *
 * T9 adds the "review" section (scale, reproject, accum, out) and a number field for the camera azimuth. Those
 * params are parsed and stored here; the renderer wires them in T10 and T11, so they change nothing on screen yet.
 */
export function Controls({ initial, renderer }: ControlsProps) {
  const bodyId = useId();
  const [state, setState] = useState(initial);
  const [open, setOpen] = useState(() => {
    try {
      return sessionStorage.getItem(OPEN_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [ft, setFt] = useState<{ gpuMs: number | null; rafMs: number; tier: QualityTier } | null>(null);

  const rendererRef = useRef(renderer);
  useEffect(() => {
    rendererRef.current = renderer;
  }, [renderer]);

  const pending = useRef<LabState | null>(null);
  const applied = useRef<LabState>(initial);
  const raf = useRef(0);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  const commit = useCallback((next: LabState) => {
    setState(next);
    pending.current = next;
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      const s = pending.current;
      pending.current = null;
      if (!s) return;
      const prev = applied.current;
      applied.current = s;
      history.replaceState(null, "", `?${serialiseLabState(s)}`);
      // The output mode is a context attribute (T11): a change, including a reference (accum > 0, single only),
      // needs a fresh page.
      if (outputFor(s).mode !== outputFor(prev).mode) return location.reload();
      rendererRef.current?.setState(s);
    });
  }, []);

  // The frame-time readout: gpuMs is the EXT_disjoint_timer_query_webgl2 mean; null → the rAF interval instead.
  useEffect(() => {
    if (!renderer) return;
    const buf: FrameTime[] = [];
    const mean = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
    const off = renderer.onFrameTime((t) => {
      buf.push(t);
      if (buf.length > 120) buf.shift();
    });
    const id = window.setInterval(() => {
      if (!buf.length) return;
      const gpu = buf.map((t) => t.gpuMs).filter((x): x is number => x !== null);
      setFt({ gpuMs: gpu.length ? mean(gpu) : null, rafMs: mean(buf.map((t) => t.rafMs)), tier: buf[buf.length - 1]!.tier });
      buf.length = 0;
    }, 500);
    return () => {
      off();
      window.clearInterval(id);
    };
  }, [renderer]);

  const set = useCallback(<K extends keyof LabState>(k: K, v: LabState[K]) => commit({ ...state, [k]: v }), [commit, state]);

  // The real sun and moon for date + t (the panel's readouts and the "off" fallbacks of the overrides).
  const date = labDate(state);
  const real = sunAt(date);
  const lum = moonAt(date);
  const override = state.sunAz !== null || state.sunEl !== null;
  const az = state.sunAz ?? Math.round(real.azimuthDeg);
  const el = state.sunEl ?? Math.round(real.elevationDeg);
  const viewAz = state.view ?? (el > -2 ? az : lum.altitudeDeg > 0 ? Math.round(lum.azimuthDeg) : 180);

  // The review params (T9) and the output switches (T11).
  const { scale, reproject, accum, out, sout } = state;
  // scale null → the live tier's scale (with tier=auto that is the tier the renderer settled on).
  const liveTier: QualityTier = state.tier === "auto" ? (renderer?.tier ?? ft?.tier ?? "high") : state.tier;
  const tierScale = TIERS[liveTier].scale;

  const toggleOpen = () =>
    setOpen((o) => {
      try {
        sessionStorage.setItem(OPEN_KEY, o ? "0" : "1");
      } catch {
        /* private mode: the panel just starts collapsed next load */
      }
      return !o;
    });

  const debugOptions = ["", ...SHADER_DEBUG_VIEWS, "noise"];
  if (!debugOptions.includes(state.debug)) debugOptions.push(state.debug);

  return (
    <aside
      aria-label="Lab controls"
      data-vol-controls=""
      className="fixed top-3 right-3 z-10 flex w-[264px] flex-col gap-2 rounded-lg border border-hairline bg-ink p-2.5 font-mono text-xs text-text"
    >
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={toggleOpen}
          className="rounded px-1 py-0.5 text-graphite hover:bg-surface-2 hover:text-text"
        >
          controls <span aria-hidden="true">{open ? "−" : "+"}</span>
        </button>
        <FrameReadout ft={ft} />
      </div>

      {open && (
        <div id={bodyId} className="flex max-h-[calc(100dvh-64px)] flex-col gap-2 overflow-y-auto">
          <Section title="presets">
            <div role="group" aria-label="presets" className="grid grid-cols-3 gap-1">
              {(["A", "B", "C"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  title={`${LAB_PRESETS[k].t} ${LAB_PRESETS[k].type}`}
                  onClick={() => commit(presetState(k))}
                  className="rounded border border-transparent px-1 py-0.5 text-graphite hover:border-hairline hover:text-text"
                >
                  {k}
                </button>
              ))}
            </div>
          </Section>

          <Section title="time (Asia/Dhaka)">
            <DateField label="date" value={state.date} onChange={(v) => set("date", v)} />
            <Slider
              label="time"
              min={0}
              max={1439}
              step={5}
              value={minutesOf(state.t)}
              format={hm}
              onInput={(v) => set("t", hm(v))}
            />
            <p className="text-graphite">
              sun {signedDeg(real.elevationDeg)} az {deg(real.azimuthDeg)}
            </p>
          </Section>

          <Section title="clouds">
            <Slider label="coverage" min={0} max={1} step={0.01} value={state.cov} format={(v) => v.toFixed(2)} onInput={(v) => set("cov", v)} />
            <Seg<CloudType>
              label="cloud type"
              cols={3}
              value={state.type}
              options={[
                { value: "stratus", text: "stratus", title: "stratus" },
                { value: "cumulus", text: "cumulus", title: "cumulus" },
                { value: "cumulonimbus", text: "cb", title: "cumulonimbus" },
              ]}
              onPick={(v) => set("type", v)}
            />
            <Slider label="precipitation" min={0} max={1} step={0.01} value={state.precip} format={(v) => v.toFixed(2)} onInput={(v) => set("precip", v)} />
          </Section>

          <Section title="wind">
            <Slider label="km/h" min={0} max={60} value={state.wind} format={(v) => String(Math.round(v))} onInput={(v) => set("wind", v)} />
            <Seg
              label={`from ${deg(state.from)}`}
              cols={8}
              value={state.from}
              options={WIND_POINTS}
              onPick={(v) => set("from", v)}
            />
          </Section>

          <Section title="sun">
            <Slider
              label="azimuth"
              min={0}
              max={359}
              value={az}
              format={deg}
              onInput={(v) => commit({ ...state, sunAz: v, sunEl: state.sunEl ?? el })}
            />
            <Slider
              label="elevation"
              min={-90}
              max={90}
              value={el}
              format={deg}
              onInput={(v) => commit({ ...state, sunEl: v, sunAz: state.sunAz ?? az })}
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-graphite">{override ? "override" : "real sun"}</span>
              <button
                type="button"
                onClick={() => commit({ ...state, sunAz: null, sunEl: null })}
                disabled={!override}
                className="rounded border border-hairline px-1.5 py-0.5 hover:bg-surface-2 disabled:opacity-50"
              >
                use real sun
              </button>
            </div>
            <Seg<CloudAtSun>
              label="cloud at sun"
              cols={3}
              value={state.cloudAtSun}
              options={[
                { value: "off", text: "off", title: "no forced cell" },
                { value: "cover", text: "cover", title: "a dense cell over the sun" },
                { value: "edge", text: "edge", title: "the cell's edge on the sun" },
              ]}
              onPick={(v) => set("cloudAtSun", v)}
            />
          </Section>

          <Section title="render">
            <Seg<QualityTier | "auto">
              label="tier"
              cols={4}
              value={state.tier}
              options={[
                { value: "high", text: "high", title: "high tier" },
                { value: "medium", text: "medium", title: "medium tier" },
                { value: "low", text: "low", title: "low tier" },
                { value: "auto", text: "auto", title: "governed by frame time" },
              ]}
              onPick={(v) => set("tier", v)}
            />
            <Toggle label="freeze time" checked={state.freeze} onChange={(v) => set("freeze", v)} />
            <NumField label="seed" value={state.seed} onChange={(v) => set("seed", Math.trunc(v))} />
            <Slider
              label="camera view"
              field="view azimuth"
              min={0}
              max={359}
              value={viewAz}
              format={deg}
              onInput={(v) => set("view", v)}
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-graphite">{state.view === null ? "facing sun" : "fixed"}</span>
              <button
                type="button"
                onClick={() => set("view", null)}
                disabled={state.view === null}
                className="rounded border border-hairline px-1.5 py-0.5 hover:bg-surface-2 disabled:opacity-50"
              >
                face sun
              </button>
            </div>
            <SelectField
              label="debug view"
              value={state.debug}
              options={debugOptions.map((v) => ({ value: v, text: v === "" ? "off" : v }))}
              onChange={(v) => set("debug", v)}
            />
          </Section>

          <Section title="review">
            <Slider
              label="cloud scale"
              min={SCALE_RANGE.min}
              max={SCALE_RANGE.max}
              step={0.05}
              value={scale ?? tierScale}
              format={(v) => v.toFixed(2)}
              onInput={(v) => set("scale", Math.round(v * 100) / 100)}
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-graphite">{scale === null ? `tier · ${tierScale.toFixed(2)}` : "override"}</span>
              <button
                type="button"
                onClick={() => set("scale", null)}
                disabled={scale === null}
                className="rounded border border-hairline px-1.5 py-0.5 hover:bg-surface-2 disabled:opacity-50"
              >
                use tier scale
              </button>
            </div>
            <Toggle
              label="reprojection"
              title="off: every pixel marched each frame"
              checked={reproject === 1}
              onChange={(v) => set("reproject", v ? 1 : 0)}
            />
            <NumField
              label="accum frames"
              min={0}
              max={ACCUM_MAX}
              value={accum}
              onChange={(v) => set("accum", Math.trunc(Math.min(ACCUM_MAX, Math.max(0, v))))}
            />
            <SelectField
              label="output"
              value={out}
              options={[
                { value: "single", text: "single" },
                { value: "layered", text: "layered" },
              ]}
              onChange={(v) => set("out", v === "layered" ? "layered" : "single")}
            />
            {out === "layered" && (
              <>
                <Slider
                  label="layer scale"
                  min={SOUT_RANGE.min}
                  max={SOUT_RANGE.max}
                  step={0.05}
                  value={sout ?? scale ?? tierScale}
                  format={(v) => v.toFixed(2)}
                  onInput={(v) => set("sout", Math.round(v * 100) / 100)}
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-graphite">{sout === null ? "cloud scale" : "override"}</span>
                  <button
                    type="button"
                    onClick={() => set("sout", null)}
                    disabled={sout === null}
                    className="rounded border border-hairline px-1.5 py-0.5 hover:bg-surface-2 disabled:opacity-50"
                  >
                    use cloud scale
                  </button>
                </div>
                <Toggle
                  label="lift alpha"
                  title="off: clamp C to A (the original brief)"
                  checked={state.lift === 1}
                  onChange={(v) => set("lift", v ? 1 : 0)}
                />
                <Toggle
                  label="show clamp"
                  title="paint where the C ≤ A clamp binds"
                  checked={state.clampviz === 1}
                  onChange={(v) => set("clampviz", v ? 1 : 0)}
                />
              </>
            )}
            <Toggle
              label="hold"
              title="draw clouds on march frames only"
              checked={state.hold === 1}
              onChange={(v) => set("hold", v ? 1 : 0)}
            />
          </Section>
        </div>
      )}
    </aside>
  );
}
