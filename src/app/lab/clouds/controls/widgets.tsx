"use client";

import { useId, type ReactNode } from "react";

/** The panel's primitives (owner T3): Geist Mono 12px, tokens only, every control labelled. */

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-1.5 border-t border-hairline pt-2 first:border-t-0 first:pt-0">
      <p className="text-[10px] tracking-wider text-graphite uppercase">{title}</p>
      {children}
    </section>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  format,
  disabled = false,
  onInput,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format: (v: number) => string;
  disabled?: boolean;
  onInput: (v: number) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-graphite">
          {label}
        </label>
        <span className="tabular-nums text-text">{format(value)}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onInput(Number(e.target.value))}
        className="w-full [accent-color:var(--text)] disabled:opacity-50"
      />
    </div>
  );
}

/** A one-of button group (keyboard: each button is a normal control; Tab visits, Space activates). */
export function Seg<T extends string | number>({
  label,
  value,
  cols,
  options,
  onPick,
}: {
  label: string;
  value: T;
  cols: number;
  options: { value: T; text: string; title: string }[];
  onPick: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          title={o.title}
          aria-pressed={o.value === value}
          onClick={() => onPick(o.value)}
          className={
            o.value === value
              ? "rounded border border-hairline bg-surface-2 px-1 py-0.5 text-text"
              : "rounded border border-transparent px-1 py-0.5 text-graphite hover:border-hairline hover:text-text"
          }
        >
          {o.text}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex items-center gap-1.5 text-graphite">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-3 [accent-color:var(--text)]"
      />
      <span className={checked ? "text-text" : undefined}>{label}</span>
    </label>
  );
}

export function NumField({
  label,
  value,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex items-baseline justify-between gap-2 text-graphite">
      {label}
      <input
        id={id}
        type="number"
        step={step}
        value={value}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(v);
        }}
        className="w-16 rounded border border-hairline bg-surface px-1 py-0.5 text-right tabular-nums text-text"
      />
    </label>
  );
}

export function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; text: string }[];
  onChange: (v: string) => void;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex items-baseline justify-between gap-2 text-graphite">
      {label}
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-hairline bg-surface px-1 py-0.5 text-text"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.text}
          </option>
        ))}
      </select>
    </label>
  );
}

export function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex items-baseline justify-between gap-2 text-graphite">
      {label}
      <input
        id={id}
        type="date"
        value={value}
        onChange={(e) => {
          // A half-typed date fires change with ""; keep the current day instead of falling to the default.
          if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) onChange(e.target.value);
        }}
        className="rounded border border-hairline bg-surface px-1 py-0.5 tabular-nums text-text"
      />
    </label>
  );
}

/** The header's ms readout: GPU ms (timer query) when the browser reports it, else the rAF interval. */
export function FrameReadout({ ft }: { ft: { gpuMs: number | null; rafMs: number; tier: string } | null }) {
  if (!ft) return <span className="tabular-nums text-graphite">… ms</span>;
  const ms = ft.gpuMs !== null ? `gpu ${ft.gpuMs.toFixed(1)} ms` : `rAF ${ft.rafMs.toFixed(1)} ms`;
  return (
    <span className="tabular-nums text-graphite" title="mean frame time and tier">
      {ms} · {ft.tier}
    </span>
  );
}
