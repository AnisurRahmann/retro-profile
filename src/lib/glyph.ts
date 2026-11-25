export const TILE_COLOURS = ["slate", "teal", "plum", "olive", "rust", "steel"] as const;
export type TileColour = (typeof TILE_COLOURS)[number];

/** FNV-1a 32-bit. Stable across builds and runtimes. */
export function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function tileColour(id: string): TileColour {
  return TILE_COLOURS[hash(id) % TILE_COLOURS.length]!;
}

export function monogram(title: string): string {
  const words = title.split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase();
  const w = words[0] ?? "?";
  return (w[0] ?? "?").toUpperCase() + (w[1] ?? "").toLowerCase();
}
