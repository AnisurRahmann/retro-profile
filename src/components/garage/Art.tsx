import type { IllustrationPaths } from "@/schema";

/** The traced layers of one part, outline silhouette first. Colours come from the i-* palette classes. */
export function Art({ paths, name }: { paths: IllustrationPaths; name: string }) {
  const layers = paths[name];
  if (!layers) throw new Error(`no traced paths for part "${name}"`);
  return (
    <>
      {layers.map(([cls, d], index) => (
        <path key={index} className={cls} d={d} />
      ))}
    </>
  );
}

export const at = (placed: { x: number; y: number; scale: number }) =>
  `translate(${placed.x} ${placed.y})${placed.scale === 1 ? "" : ` scale(${placed.scale})`}`;
