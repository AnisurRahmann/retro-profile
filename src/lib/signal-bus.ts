/** Tiny pub/sub for Signal Field ripples. Coordinates are viewport CSS px. */
export type SignalKind = "ambient" | "interactive";
/** ambient = background chatter (status line): shorter, softer, lets the loop drop to 30fps. */
export type Signal = { x: number; y: number; amp: number; kind?: SignalKind };

/** Status-line ripple amplitude (also SF.ambientAmp). */
export const AMBIENT_AMP = 0.35;
type Listener = (s: Signal) => void;

const listeners = new Set<Listener>();

export function emitSignal(s: Signal): void {
  listeners.forEach((l) => l(s));
}

export function onSignal(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Emit from the centre (or top-left) of an element, if it's on screen. */
export function emitFrom(
  el: Element | null | undefined,
  amp: number,
  { corner = false, kind = "interactive" }: { corner?: boolean; kind?: SignalKind } = {},
): void {
  if (!el || listeners.size === 0) return;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return;
  emitSignal({ x: corner ? r.left : r.left + r.width / 2, y: corner ? r.top : r.top + r.height / 2, amp, kind });
}
