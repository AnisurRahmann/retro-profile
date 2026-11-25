/** Tiny pub/sub for the Sylhet Sky background. One event today: a meteor across the night sky. */
export type SkyEvent = { type: "meteor" };
type Listener = (e: SkyEvent) => void;

const listeners = new Set<Listener>();

export function emitSky(e: SkyEvent): void {
  listeners.forEach((l) => l(e));
}

export function onSky(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
