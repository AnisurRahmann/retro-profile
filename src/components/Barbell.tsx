import type { CSSProperties, ReactNode } from "react";

/**
 * Side-on barbell. Plates load from the collar outward on each sleeve.
 * Whip: the shaft is a quadratic curve and each sleeve drops and tilts with --sag (0 to 22).
 */
export function Barbell({
  left,
  right,
  sag,
  className = "",
  label,
}: {
  left: ReactNode;
  right: ReactNode;
  /** leave undefined to let CSS drive --sag (hero) */
  sag?: number;
  className?: string;
  label: string;
}) {
  const style = sag === undefined ? undefined : ({ "--sag": sag } as CSSProperties);
  return (
    <div className={`barbell ${className}`} style={style} role="group" aria-label={label}>
      <div className="sleeve sleeve-l">
        <span className="collar" />
        {left}
      </div>
      <div className="barbell-shaft" aria-hidden="true">
        <svg viewBox="0 0 100 44" preserveAspectRatio="none" focusable="false">
          <path d="M0,44 Q50,0 100,44" />
        </svg>
      </div>
      <div className="sleeve sleeve-r">
        <span className="collar" />
        {right}
      </div>
    </div>
  );
}
