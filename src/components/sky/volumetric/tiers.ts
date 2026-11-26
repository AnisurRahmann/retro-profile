/**
 * Quality tiers (owner T7): the starting tier and the automatic step-down. Constants: TIERS in types.ts.
 * PLACEHOLDER (T0): "auto" → high on a fine pointer, medium on a coarse one; never steps down.
 */
import type { CreateTierGovernor, ResolveTier } from "./types";

export const resolveTier: ResolveTier = (requested, env) => (requested !== "auto" ? requested : env.coarsePointer ? "medium" : "high");

export const createTierGovernor: CreateTierGovernor = () => ({ sample: () => null });
