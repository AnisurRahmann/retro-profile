import type { CSSProperties, ReactNode } from "react";
import {
  bikeLayout,
  binLayout,
  botLayout,
  boxStyle,
  calendarLayout,
  chalkLayout,
  kitLayout,
  lampLayout,
  pegboardLayout,
  phoneLayout,
  spriteHref,
  whiteboardLayout,
  windowLayout,
  type ObjectLayout,
} from "@/illustrations/compose";
import { DhakaClock } from "./DhakaClock";
import { LazyParts, spriteRef } from "./Parts";

/**
 * A03 to A12, server-rendered in their final pose. Motion is in GarageRuntime and globals.css.
 * The box keeps the drawing's proportions, so live HTML can be laid over a blank surface in percentages
 * and sized in container units: it scales with the object.
 */
function Box({ layout, children, ...data }: { layout: Pick<ObjectLayout, "asset" | "width" | "height" | "nodes">; children?: ReactNode } & Record<`data-${string}`, string | number>) {
  return (
    <span className="ill-box" style={{ "--ar": Math.round((layout.width / layout.height) * 1000) / 1000 } as CSSProperties} {...data}>
      <LazyParts layout={layout} />
      {children}
    </span>
  );
}

/** A03. The six numbers are live text on the blank board, three to a row. They repeat the list in the header, so they are hidden from assistive tech. */
export function WhiteboardObject({ values }: { values: string[] }) {
  const layout = whiteboardLayout();
  const rows = Array.from({ length: Math.ceil(values.length / layout.cols) }, (_, row) => values.slice(row * layout.cols, (row + 1) * layout.cols));
  return (
    <Box layout={layout} data-line={layout.line} data-rest={layout.rest.join(",")}>
      <span className="wb" aria-hidden="true" style={boxStyle(layout, layout.grid)}>
        {rows.map((row, rowIndex) => (
          <span key={rowIndex} className="wb-row" data-wb-row="">
            {row.map((value, column) => {
              const at = layout.underlines[rowIndex * layout.cols + column]!;
              return (
                <span key={value} className="wb-n display" data-hot="" data-x={at.x} data-y={at.y}>
                  {value}
                </span>
              );
            })}
          </span>
        ))}
      </span>
    </Box>
  );
}

export function BotObject() {
  return <Box layout={botLayout()} />;
}

export function BikeObject() {
  return <Box layout={bikeLayout()} />;
}

export function ChalkObject() {
  return <Box layout={chalkLayout()} />;
}

/** A08. Every goal is in the markup, the first one shows. The runtime tears a page and shows the next. Decorative: the goals are read at the link's target. */
export function CalendarObject({ goals }: { goals: { lift: string; target: string }[] }) {
  const layout = calendarLayout();
  return (
    <Box layout={layout}>
      <span className="cal" aria-hidden="true" style={boxStyle(layout, layout.page)}>
        {goals.map((goal, index) => (
          <span key={`${goal.lift} ${goal.target}`} className="cal-goal" data-goal="" hidden={index > 0}>
            <b>{goal.lift}</b>
            <span>{goal.target}</span>
          </span>
        ))}
      </span>
    </Box>
  );
}

export function BinObject() {
  const layout = binLayout();
  return <Box layout={layout} data-throw={`${layout.into[0] - layout.ball[0]},${layout.into[1] - layout.ball[1]}`} />;
}

export function PhoneObject() {
  return <Box layout={phoneLayout()} />;
}

/** A11. The timer's display is blank in the drawing: the time in Dhaka is text, filled in by the browser. */
export function KitObject({ timeZone, placeholder }: { timeZone: string; placeholder: string }) {
  const layout = kitLayout();
  return (
    <Box layout={layout}>
      <span className="kit-clock" aria-hidden="true" style={boxStyle(layout, layout.display)}>
        <DhakaClock timeZone={timeZone} placeholder={placeholder} />
      </span>
    </Box>
  );
}

/** A12, the lamp and its light. The pull cord is drawn apart, inside the button: see LampCord. */
export function LampObject() {
  return <Box layout={lampLayout()} />;
}

/** The pull cord. It sways around the lamp's hanging point, which lies outside its own drawing. */
export function LampCord() {
  const { cord } = lampLayout();
  return (
    <svg className="ill" viewBox={`0 0 ${cord.width} ${cord.height}`} aria-hidden="true" focusable="false">
      <g data-p="cord-sway" style={{ transformOrigin: `${cord.sway[0]}px ${cord.sway[1]}px` }}>
        <g data-p="cord">
          <use {...spriteRef(spriteHref("a12", cord.name))} />
        </g>
      </g>
    </svg>
  );
}

/** where the cord hangs in the lamp's footprint, in scene units */
export function lampCordPlace(scale: number) {
  const { box } = lampLayout().cord;
  return { "--cord-x": Math.round((box.x + box.w / 2) * scale), "--cord-y": Math.round(box.y * scale), "--cord-w": Math.round(box.w * scale * 10) / 10, "--cord-h": Math.round(box.h * scale * 10) / 10 } as CSSProperties;
}

const DECOR: Record<string, () => ObjectLayout> = { pegboard: pegboardLayout, window: windowLayout };

/** Wall fixtures from the A12 sheet: decoration, not links. */
export function DecorObject({ id }: { id: string }) {
  const layout = DECOR[id];
  if (!layout) throw new Error(`no decor "${id}"`);
  return <LazyParts layout={layout()} />;
}
