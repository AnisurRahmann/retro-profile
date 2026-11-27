/**
 * Quality tiers (owner T7): the starting tier and the automatic step-down. Constants: TIERS in types.ts.
 * "auto" starts high on a fine pointer and medium on a coarse one. While auto, the governor steps down one tier
 * when the median frame time over the last STEP_DOWN_WINDOW_MS is above STEP_DOWN_MS, then watches a fresh window.
 */
import { QUALITY_TIERS, type CreateTierGovernor, type QualityTier, type ResolveTier } from "./types";

/** Median frame time (ms) above which auto steps down. */
export const STEP_DOWN_MS = 20;
/** How long (ms) the median must be measured over (and stay over STEP_DOWN_MS) before a step. */
export const STEP_DOWN_WINDOW_MS = 3000;

export const resolveTier: ResolveTier = (requested, env) => (requested !== "auto" ? requested : env.coarsePointer ? "medium" : "high");

/** The next tier down, or null at the bottom. */
export function lowerTier(t: QualityTier): QualityTier | null {
  return QUALITY_TIERS[QUALITY_TIERS.indexOf(t) + 1] ?? null;
}

export function median(xs: readonly number[]): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export const createTierGovernor: CreateTierGovernor = (start, enabled) => {
  let tier = start;
  let since: number | null = null;
  const at: number[] = [];
  const ms: number[] = [];
  return {
    sample(frameMs, nowMs) {
      if (!enabled || !Number.isFinite(frameMs)) return null;
      since ??= nowMs;
      at.push(nowMs);
      ms.push(frameMs);
      while (at.length && at[0]! < nowMs - STEP_DOWN_WINDOW_MS) {
        at.shift();
        ms.shift();
      }
      if (nowMs - since < STEP_DOWN_WINDOW_MS || median(ms) <= STEP_DOWN_MS) return null;
      const next = lowerTier(tier);
      if (!next) return null;
      tier = next;
      since = nowMs;
      at.length = 0;
      ms.length = 0;
      return next;
    },
  };
};
