"use client";

import { useId, useState, type ReactNode } from "react";

export function ShowMore({
  hidden,
  count,
  moreLabel,
  lessLabel,
  sky,
}: {
  hidden: ReactNode;
  count: number;
  moreLabel: string;
  lessLabel: string;
  /** data-on-sky id: the button sits on the sky. */
  sky?: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <>
      <div id={panelId} className="reveal" data-open={open} inert={!open}>
        <div className="reveal-inner">
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
        data-on-sky={sky}
      >
        {open ? lessLabel : moreLabel}
      </button>
    </>
  );
}
