"use client";

import type { Ui } from "@/content";
import { toggleRedlines, toggleTheme, useRedlines, useTheme } from "@/lib/prefs";

/**
 * The active cell is painted by CSS from the <html> data attributes, so the
 * switch is visually correct before hydration. React only owns aria-checked.
 */
export function RedlineSwitch({ copy }: { copy: Ui["redlines"] }) {
  const on = useRedlines() === "on";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={copy.label}
      title={copy.aria}
      className="switch switch--redline"
      onClick={toggleRedlines}
    >
      <span className="switch-name" aria-hidden="true">
        <span className="switch-long">{copy.label}</span>
        <span className="switch-short">{copy.short}</span>
      </span>
      <span className="switch-cell" data-cell="off" aria-hidden="true">
        {copy.off}
      </span>
      <span className="switch-cell" data-cell="on" aria-hidden="true">
        {copy.on}
      </span>
    </button>
  );
}

export function ThemeSwitch({ copy }: { copy: Ui["theme"] }) {
  const blueprint = useTheme() === "blueprint";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={blueprint}
      aria-label={copy.aria}
      className="switch switch--theme"
      onClick={toggleTheme}
    >
      <span className="switch-cell" data-cell="paper" aria-hidden="true">
        {copy.paper}
      </span>
      <span className="switch-cell" data-cell="blueprint" aria-hidden="true">
        {copy.blueprint}
      </span>
    </button>
  );
}

/** Shown on the goals sheet when redlines are off. */
export function RedlinesOnButton({ label }: { label: string }) {
  return (
    <button type="button" className="btn btn--red" onClick={toggleRedlines}>
      {label}
    </button>
  );
}
