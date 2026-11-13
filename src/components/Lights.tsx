import type { CSSProperties } from "react";
import type { Status } from "@/schema";

/** Referee lights: three circles in a light box, always followed by a text label. */
export function Lights({ status, reveal = false, label = true }: { status: Status; reveal?: boolean; label?: boolean }) {
  return (
    <span className="lights" data-reveal={reveal ? "" : undefined} data-status={status.id}>
      <span className="lightbox" aria-hidden="true">
        {status.lights.map((state, index) => (
          <i key={index} className="light" data-s={state} style={{ "--i": index } as CSSProperties} />
        ))}
      </span>
      {label ? (
        <span className="label">
          <b>{status.call}</b> <span className="plain">{status.plain}</span>
        </span>
      ) : null}
    </span>
  );
}
