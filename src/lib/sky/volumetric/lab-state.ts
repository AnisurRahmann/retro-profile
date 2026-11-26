/**
 * The lab's URL state (owner T3): parseLabState / serialiseLabState as typed in
 * src/components/sky/volumetric/types.ts. PLACEHOLDER (T0): reads and writes every key with basic validation;
 * T3 adds clamping to the documented ranges and round-trip tests.
 */
import {
  CLOUD_TYPES,
  LAB_DEFAULTS,
  QUALITY_TIERS,
  type CloudAtSun,
  type ParseLabState,
  type SerialiseLabState,
} from "@/components/sky/volumetric/types";

const num = (v: string | null, d: number) => (v !== null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : d);
const nullable = (v: string | null) => (v !== null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null);
const oneOf = <T extends string>(v: string | null, all: readonly T[], d: T): T => (all.includes(v as T) ? (v as T) : d);
const AT_SUN: Record<string, CloudAtSun> = { "0": "off", "1": "cover", edge: "edge" };

export const parseLabState: ParseLabState = (search) => {
  const q = new URLSearchParams(search);
  const d = LAB_DEFAULTS;
  return {
    date: /^\d{4}-\d{2}-\d{2}$/.test(q.get("date") ?? "") ? q.get("date")! : d.date,
    t: /^\d{2}:\d{2}$/.test(q.get("t") ?? "") ? q.get("t")! : d.t,
    cov: num(q.get("cov"), d.cov),
    type: oneOf(q.get("type"), CLOUD_TYPES, d.type),
    wind: num(q.get("wind"), d.wind),
    from: num(q.get("from"), d.from),
    precip: num(q.get("precip"), d.precip),
    tier: oneOf(q.get("tier"), [...QUALITY_TIERS, "auto" as const], d.tier),
    sunAz: nullable(q.get("sunAz")),
    sunEl: nullable(q.get("sunEl")),
    cloudAtSun: AT_SUN[q.get("cloudAtSun") ?? ""] ?? d.cloudAtSun,
    freeze: q.get("freeze") === "1",
    seed: num(q.get("seed"), d.seed),
    view: nullable(q.get("view")),
    debug: q.get("debug") ?? d.debug,
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
  return q.toString();
};
