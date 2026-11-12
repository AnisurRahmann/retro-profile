import clsx from "clsx";
import type { Status, StatusId } from "@/content.schema";

/**
 * Leaf marks with no content imports, safe to use from client islands
 * without pulling src/content.ts into their bundles.
 */

export function Arrow() {
  return (
    <svg className="btn-arrow" viewBox="0 0 22 10" aria-hidden="true" focusable="false">
      <path d="M0 5H20M15 1L20 5L15 9" />
    </svg>
  );
}

export function Stamp({ status, red }: { status: Status; red?: boolean }) {
  return (
    <span className={clsx("stamp", red && "stamp--red")} data-status={status.id}>
      {status.label}
    </span>
  );
}

/** The outline style that encodes a status. Used by the legend, counters and register. */
export function Swatch({ status }: { status: StatusId }) {
  return (
    <svg className="swatch" viewBox="0 0 34 14" aria-hidden="true" focusable="false">
      <rect className="shape" data-status={status} x="1" y="1" width="32" height="12" />
      {status === "IN_BUILD" && <rect className="shape-hatch" x="1" y="1" width="32" height="12" />}
      {status === "BUILT" && <rect className="shape-inner" x="4" y="4" width="26" height="6" />}
    </svg>
  );
}
