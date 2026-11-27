/**
 * Whether /lab/clouds exists in this build (owner T0): dev and test builds, or a production build made with
 * NEXT_PUBLIC_SKY_DEBUG=1. Written out as a module constant so the build folds it (DECISIONS #120).
 */
export function labEnabled(env: { nodeEnv?: string; e2e?: string; debug?: string }): boolean {
  return env.nodeEnv !== "production" || env.e2e === "1" || env.debug === "1";
}

export const LAB_ENABLED = process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_E2E === "1" || process.env.NEXT_PUBLIC_SKY_DEBUG === "1";
