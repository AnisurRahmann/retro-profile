/**
 * The lab's URL state (owner T3): parseLabState / serialiseLabState as typed in
 * src/components/sky/volumetric/types.ts. Defaults are state A (LAB_DEFAULTS); out-of-range values clamp to the
 * ranges BRIEF.md documents, and malformed values fall back to the default. cloudAtSun also accepts "cover" as a
 * synonym for "1" (M1 follow-up F1).
 *
 * The review params: scale, reproject, accum and out (T9), and T11's output switches sout, hold, lift and clampviz
 * (M2). Their defaults are in LAB_DEFAULTS like every other field's.
 */
import {
  CLOUD_TYPES,
  LAB_DEFAULTS,
  LAB_PRESETS,
  QUALITY_TIERS,
  type CloudAtSun,
  type CloudType,
  type LabOutput,
  type LabState,
  type ParseLabState,
  type QualityTier,
  type SerialiseLabState,
} from "@/components/sky/volumetric/types";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const num = (v: string | null, d: number) => {
  const n = Number(v);
  return v !== null && v !== "" && Number.isFinite(n) ? n : d;
};
const clamped = (v: string | null, lo: number, hi: number, d: number) => clamp(num(v, d), lo, hi);
const nullable = (v: string | null, lo: number, hi: number): number | null => {
  const n = Number(v);
  return v !== null && v !== "" && Number.isFinite(n) ? clamp(n, lo, hi) : null;
};
const oneOf = <T extends string>(v: string | null, all: readonly T[], d: T): T => (all.includes(v as T) ? (v as T) : d);

const TIERS_AND_AUTO = [...QUALITY_TIERS, "auto" as const] satisfies readonly (QualityTier | "auto")[];
const AT_SUN: Record<string, CloudAtSun> = { "0": "off", "1": "cover", cover: "cover", edge: "edge" };

/** scale: the cloud target's scale, a fraction of the drawing buffer. */
export const SCALE_RANGE = { min: 0.25, max: 1 } as const;
/** accum: the most frames a reference render averages. */
export const ACCUM_MAX = 256;
/** sout: the layered cloud canvas's scale, a fraction of the drawing buffer (T11). */
export const SOUT_RANGE = { min: 0.2, max: 1 } as const;
const OUTPUTS: readonly LabOutput[] = ["single", "layered"];
/** A 0 | 1 switch: "0" or "1", anything else → the default. */
const bit = (v: string | null, d: 0 | 1): 0 | 1 => (v === "1" ? 1 : v === "0" ? 0 : d);

/** "2026-12-15" only when it is a real calendar day (not 2026-02-30). */
const validDate = (v: string): boolean => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return false;
  const [y, mo, d] = m.slice(1).map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
};

/** "11:00" only with real clock fields (00–23 h, 00–59 min). */
const validTime = (v: string): boolean => {
  const m = /^(\d{2}):(\d{2})$/.exec(v);
  if (!m) return false;
  const [h, mi] = m.slice(1).map(Number) as [number, number];
  return h <= 23 && mi <= 59;
};

export const parseLabState: ParseLabState = (search) => {
  const q = new URLSearchParams(search);
  const d = LAB_DEFAULTS;
  const date = q.get("date") ?? "";
  const t = q.get("t") ?? "";
  return {
    date: validDate(date) ? date : d.date,
    t: validTime(t) ? t : d.t,
    cov: clamped(q.get("cov"), 0, 1, d.cov),
    type: oneOf<CloudType>(q.get("type"), CLOUD_TYPES, d.type),
    wind: clamped(q.get("wind"), 0, 60, d.wind),
    from: clamped(q.get("from"), 0, 359, d.from),
    precip: clamped(q.get("precip"), 0, 1, d.precip),
    tier: oneOf<QualityTier | "auto">(q.get("tier"), TIERS_AND_AUTO, d.tier),
    sunAz: nullable(q.get("sunAz"), 0, 359),
    sunEl: nullable(q.get("sunEl"), -90, 90),
    cloudAtSun: AT_SUN[q.get("cloudAtSun") ?? ""] ?? d.cloudAtSun,
    freeze: q.get("freeze") === "1",
    seed: Math.trunc(clamped(q.get("seed"), -0x8000_0000, 0x7fff_ffff, d.seed)),
    view: nullable(q.get("view"), 0, 359),
    debug: q.get("debug") ?? d.debug,
    // Absent, empty or malformed → the default (scale: the tier's own).
    scale: nullable(q.get("scale"), SCALE_RANGE.min, SCALE_RANGE.max),
    reproject: bit(q.get("reproject"), d.reproject),
    accum: Math.trunc(clamped(q.get("accum"), 0, ACCUM_MAX, d.accum)),
    out: oneOf<LabOutput>(q.get("out"), OUTPUTS, d.out),
    sout: nullable(q.get("sout"), SOUT_RANGE.min, SOUT_RANGE.max),
    hold: bit(q.get("hold"), d.hold),
    lift: bit(q.get("lift"), d.lift),
    clampviz: bit(q.get("clampviz"), d.clampviz),
  };
};

export const serialiseLabState: SerialiseLabState = (s) => {
  const q = new URLSearchParams();
  q.set("date", s.date);
  q.set("t", s.t);
  q.set("cov", String(s.cov));
  q.set("type", s.type);
  q.set("wind", String(s.wind));
  q.set("from", String(s.from));
  q.set("precip", String(s.precip));
  q.set("tier", s.tier);
  q.set("sunAz", s.sunAz === null ? "" : String(s.sunAz));
  q.set("sunEl", s.sunEl === null ? "" : String(s.sunEl));
  q.set("cloudAtSun", s.cloudAtSun === "off" ? "0" : s.cloudAtSun === "cover" ? "1" : "edge");
  q.set("freeze", s.freeze ? "1" : "0");
  q.set("seed", String(s.seed));
  q.set("view", s.view === null ? "" : String(s.view));
  q.set("debug", s.debug);
  q.set("scale", s.scale === null ? "" : String(s.scale));
  q.set("reproject", String(s.reproject));
  q.set("accum", String(s.accum));
  q.set("out", s.out);
  q.set("sout", s.sout === null ? "" : String(s.sout));
  q.set("hold", String(s.hold));
  q.set("lift", String(s.lift));
  q.set("clampviz", String(s.clampviz));
  return q.toString();
};

/** The state a preset button applies: the acceptance URLs of BRIEF.md §7 (fields not given take the defaults). */
export const presetState = (p: keyof typeof LAB_PRESETS): LabState => ({ ...LAB_DEFAULTS, ...LAB_PRESETS[p] });
