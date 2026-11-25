"use client";

import { useId, useState, type ReactNode } from "react";

export function ShowMore({
  hidden,
  count,
  moreLabel,
  lessLabel,
}: {
  hidden: ReactNode;
  count: number;
  moreLabel: string;
  lessLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <>
      <div id={panelId} className="collapse" data-open={open} inert={!open}>
        <div className="collapse-inner">
          <div className="grid gap-2.5 pt-2.5 sm:grid-cols-2">{hidden}</div>
        </div>
      </div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="mt-3 text-sm text-graphite transition-colors duration-150 hover:text-text"
        data-count={count}
      >
        {open ? lessLabel : moreLabel}
      </button>
    </>
  );
}
