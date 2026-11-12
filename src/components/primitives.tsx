import type { ReactNode } from "react";
import clsx from "clsx";
import type { SheetMeta } from "@/content.schema";
import { profile, sheets, ui } from "@/content";
import { BUILD_DATE } from "@/lib/build";
import { arrowHead, seedFrom, wobblyEllipse, wobblyLine } from "@/lib/handdrawn";
import { sheetId } from "@/lib/derive";

export { Arrow, Stamp, Swatch } from "./marks";

/** Shared SVG definitions: the 45 degree hatch and the rough stamp edge. */
export function SvgDefs() {
  return (
    <svg className="defs" aria-hidden="true" focusable="false">
      <defs>
        <pattern
          id="ds-hatch"
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="6" style={{ stroke: "var(--hatch)", strokeWidth: 2 }} />
        </pattern>
        <filter id="ds-rough" x="-5%" y="-10%" width="110%" height="120%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="2"
            seed="7"
            result="n"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="n"
            scale="1.6"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}

/** A hand-drawn circle around its children. Only visible with redlines on. */
export function RedCircle({ children, seed }: { children: ReactNode; seed: string }) {
  return (
    <span className="rl-circle">
      {children}
      <svg
        className="redline"
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <path
          className="rl-stroke draw"
          pathLength={1}
          d={wobblyEllipse(50, 20, 47, 17, seedFrom(seed))}
        />
      </svg>
    </span>
  );
}

/** A margin note in the redline hand, with a leader arrow pointing back at the drawing. */
export function RedNote({
  children,
  seed,
  point = "up",
  className,
}: {
  children: ReactNode;
  seed: string;
  point?: "up" | "down" | "left";
  className?: string;
}) {
  const s = seedFrom(seed);
  const geo = {
    up: { line: [40, 30, 8, 5] as const, angle: Math.atan2(5 - 30, 8 - 40) },
    down: { line: [40, 4, 8, 29] as const, angle: Math.atan2(29 - 4, 8 - 40) },
    left: { line: [44, 16, 4, 18] as const, angle: Math.atan2(18 - 16, 4 - 44) },
  }[point];
  const [x1, y1, x2, y2] = geo.line;
  return (
    <div className={clsx("redline rl-note", className)}>
      <svg viewBox="0 0 46 34" aria-hidden="true" focusable="false">
        <path className="rl-stroke draw" pathLength={1} d={wobblyLine(x1, y1, x2, y2, s)} />
        <path
          className="rl-stroke draw"
          pathLength={1}
          style={{ "--d": "1.2s" } as React.CSSProperties}
          d={arrowHead(x2, y2, geo.angle, 9, s)}
        />
      </svg>
      <div className="hand write">
        <span className="rl-rev">{ui.redlines.nextRev}</span>
        {children}
      </div>
    </div>
  );
}

export function TitleBlock({
  sheet,
  extra,
}: {
  sheet: SheetMeta;
  extra?: { label: string; value: string }[];
}) {
  const last = sheets[sheets.length - 1]?.no ?? sheet.no;
  const tb = ui.titleBlock;
  return (
    <dl className="title-block" aria-label={tb.caption}>
      {extra?.map((row) => (
        <div className="tb-wide" key={row.label}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
      <div className="tb-two tb-big">
        <dt>{tb.title}</dt>
        <dd>{sheet.title}</dd>
      </div>
      <div className="tb-big tb-end">
        <dt>{tb.sheetNo}</dt>
        <dd>
          {sheet.no}
          <span className="muted"> / {last}</span>
        </dd>
      </div>
      <div className="tb-last">
        <dt>{tb.drawnBy}</dt>
        <dd>{profile.drawnBy}</dd>
      </div>
      <div className="tb-last">
        <dt>{tb.date}</dt>
        <dd>{BUILD_DATE}</dd>
      </div>
      <div className="tb-last tb-end">
        <dt>{tb.rev}</dt>
        <dd>{sheet.rev}</dd>
      </div>
    </dl>
  );
}

export function Sheet({
  no,
  red,
  first,
  hideHead,
  headExtra,
  titleExtra,
  children,
}: {
  no: SheetMeta["no"];
  red?: boolean;
  first?: boolean;
  hideHead?: boolean;
  headExtra?: ReactNode;
  titleExtra?: { label: string; value: string }[];
  children: ReactNode;
}) {
  const sheet = sheets.find((s) => s.no === no);
  if (!sheet) throw new Error(`unknown sheet ${no}`);
  const id = sheetId(no);
  return (
    <section
      id={id}
      className={clsx("sheet", red && "sheet--red", first && "sheet--first")}
      data-observe=""
      data-sheet={no}
      aria-labelledby={`${id}-h`}
    >
      <svg className="sheet-border" aria-hidden="true" focusable="false">
        <rect width="100%" height="100%" pathLength={1} />
      </svg>
      <div className="sheet-body">
        <header className="sheet-head">
          <p className="label sheet-no">
            {ui.sheet} {no} · {sheet.title}
          </p>
          {!hideHead && (
            <>
              <h2 id={`${id}-h`} className="display display--sheet">
                {sheet.heading}
              </h2>
              {sheet.intro && <p className="intro">{sheet.intro}</p>}
            </>
          )}
          {headExtra}
        </header>
        {children}
        <TitleBlock sheet={sheet} extra={titleExtra} />
      </div>
    </section>
  );
}
