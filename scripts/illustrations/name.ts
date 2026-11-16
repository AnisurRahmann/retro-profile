import { z } from "zod";
import type { Component } from "./types";

const partName = z.string().regex(/^[a-z][a-z0-9-]*$/);

const entrySchema = z.union([
  z.strictObject({
    name: partName,
    /** joint or anchor point, normalised to the part's bounding box */
    pivot: z.tuple([z.number().min(-0.5).max(1.5), z.number().min(-0.5).max(1.5)]),
    z: z.number().int(),
  }),
  /** a component that is on the sheet but not used, with the reason */
  z.strictObject({ ignore: z.string().min(1) }),
]);

export const partsMapSchema = z.strictObject({
  asset: z.string().regex(/^a\d{2}b?$/),
  source: z.string().min(1),
  /** set when the whole sheet is rejected: the pipeline stops after the contact sheet */
  rejected: z.string().min(1).optional(),
  /** components the sheet must split into. A regenerated sheet that splits differently fails here. */
  components: z.number().int().positive(),
  parts: z.record(z.string().regex(/^\d+$/), entrySchema),
});

export type PartsMap = z.infer<typeof partsMapSchema>;

export interface NamedPart {
  name: string;
  pivot: [number, number];
  z: number;
  /** several components may share a name (loose pieces of one part): they are traced together */
  components: Component[];
}

/**
 * Stage c. Applies the hand-written map to the split components.
 * Throws with the exact indexes when the sheet and the map disagree, so nothing is guessed.
 */
export function nameParts(components: Component[], map: PartsMap): NamedPart[] {
  if (components.length !== map.components) {
    throw new Error(
      `name: ${map.asset} split into ${components.length} components, the map expects ${map.components}. ` +
        `Open the contact sheet, then fix the sheet or the map.`,
    );
  }
  const unmapped = components.filter((component) => !(String(component.index) in map.parts)).map((component) => component.index);
  const unknown = Object.keys(map.parts).filter((index) => Number(index) >= components.length);
  if (unmapped.length > 0 || unknown.length > 0) {
    throw new Error(`name: ${map.asset} map is out of step. Unmapped components: [${unmapped.join(", ")}]. Entries with no component: [${unknown.join(", ")}].`);
  }
  const parts = new Map<string, NamedPart>();
  for (const component of components) {
    const entry = map.parts[String(component.index)]!;
    if ("ignore" in entry) continue;
    const existing = parts.get(entry.name);
    if (existing) existing.components.push(component);
    else parts.set(entry.name, { name: entry.name, pivot: entry.pivot, z: entry.z, components: [component] });
  }
  return [...parts.values()];
}
