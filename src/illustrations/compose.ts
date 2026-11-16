import type { IllustrationPart } from "@/schema";
import { manifest } from "./generated/manifest";

/**
 * How the traced parts of one object are put together. Units are source sheet pixels,
 * so parts of the same sheet keep their relative scale. Server only (the manifest is zod-parsed).
 */

export function part(asset: string, name: string): IllustrationPart {
  const found = manifest[asset]?.parts.find((entry) => entry.name === name);
  if (!found) throw new Error(`illustration part "${asset}/${name}" is not in the manifest. Run pnpm illustrations.`);
  return found;
}

/** transform-origin for a part, from its manifest pivot. Used with transform-box: fill-box. */
export function pivotOrigin(entry: IllustrationPart): string {
  return `${Math.round(entry.pivot[0] * 1000) / 10}% ${Math.round(entry.pivot[1] * 1000) / 10}%`;
}

export interface Placed {
  name: string;
  x: number;
  y: number;
  scale: number;
}

const round = (value: number) => Math.round(value * 10) / 10;

// ── A02 rack ─────────────────────────────────────────────────

/** side-on plate colours from the inside out. The order matches `buses` in content.ts. */
export const PLATE_COLOURS = ["red", "blue", "yellow", "green", "chalk", "iron"] as const;

/** where the J-hooks hold the bar, measured down from the top of the rack part */
const HOOK_Y = 145;
/** bar sleeve: distance from the bar's end to the outer face of its collar */
const SLEEVE = 100;
/** side-on plates are drawn larger than the sleeve allows: scaled, and overlapped so each shows a strip */
const PLATE_SCALE = 0.7;
const PLATE_PITCH = 14.5;
/** centre line of the bowed bar at its crown, measured down from the top of the scaled part */
const BOWED_CROWN = 14;

export function rackLayout() {
  const rack = part("a02", "rack");
  const straight = part("a02", "bar-straight");
  const bowed = part("a02", "bar-bowed");
  const width = straight.width;
  const height = rack.height;
  // the bowed bar was drawn shorter: stretch it to the straight bar's length, its crown on the hooks
  const bowedScale = straight.width / bowed.width;
  const plates = (["l", "r"] as const).flatMap((side) =>
    PLATE_COLOURS.map((colour, index) => {
      const plate = part("a02", `plate-side-${colour}`);
      const w = plate.width * PLATE_SCALE;
      const inner = SLEEVE - 1 - index * PLATE_PITCH;
      return {
        side,
        index,
        colour,
        name: plate.name,
        x: round(side === "l" ? inner - w : width - inner),
        y: round(HOOK_Y - (plate.height * PLATE_SCALE) / 2),
        scale: PLATE_SCALE,
      };
    }),
  );
  return {
    width,
    height,
    rack: { name: rack.name, x: round((width - rack.width) / 2), y: 0, scale: 1 } satisfies Placed,
    straight: { name: straight.name, x: 0, y: round(HOOK_Y - straight.height / 2), scale: 1 } satisfies Placed,
    bowed: { name: bowed.name, x: 0, y: HOOK_Y - BOWED_CROWN, scale: round(bowedScale * 1000) / 1000 } satisfies Placed,
    plates,
  };
}

// ── A01b character, whole poses ──────────────────────────────

export const CHARACTER_POSES = ["idle", "wave", "chalk"] as const;
const PUFFS = ["puff-a", "puff-b"] as const;

/** The poses stand on one baseline and share one anchor: the point between the feet (the manifest pivot). */
export function characterLayout() {
  const poses = CHARACTER_POSES.map((pose) => ({ pose, entry: part("a01b", `pose-${pose}`) }));
  const chalk = poses.find(({ pose }) => pose === "chalk")!.entry;
  const puffs = PUFFS.map((name) => part("a01b", name));
  const left = Math.max(...poses.map(({ entry }) => entry.pivot[0] * entry.width));
  const chalkAnchor = chalk.origin[0] + chalk.pivot[0] * chalk.width;
  const right = Math.max(
    ...poses.map(({ entry }) => (1 - entry.pivot[0]) * entry.width),
    ...puffs.map((puff) => puff.origin[0] + puff.width - chalkAnchor),
  );
  const height = Math.max(...poses.map(({ entry }) => entry.height));
  return {
    width: Math.ceil(left + right),
    height,
    poses: poses.map(({ pose, entry }) => ({
      pose,
      name: entry.name,
      x: round(left - entry.pivot[0] * entry.width),
      y: height - entry.height,
      scale: 1,
      origin: pivotOrigin(entry),
    })),
    // loose chalk puffs keep their place relative to the chalk pose
    puffs: puffs.map((puff) => ({
      name: puff.name,
      x: round(left + puff.origin[0] - chalkAnchor),
      y: height - chalk.height + puff.origin[1] - chalk.origin[1],
      scale: 1,
    })),
  };
}
