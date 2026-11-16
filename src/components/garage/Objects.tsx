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
  whiteboardLayout,
  windowLayout,
  type ObjectLayout,
} from "@/illustrations/compose";
import { a03 } from "@/illustrations/generated/a03";
import { a05 } from "@/illustrations/generated/a05";
import { a06 } from "@/illustrations/generated/a06";
import { a07 } from "@/illustrations/generated/a07";
import { a08 } from "@/illustrations/generated/a08";
import { a09 } from "@/illustrations/generated/a09";
import { a10 } from "@/illustrations/generated/a10";
import { a11 } from "@/illustrations/generated/a11";
import { a12 } from "@/illustrations/generated/a12";
import type { IllustrationPaths } from "@/schema";
import { Art } from "./Art";
import { DhakaClock } from "./DhakaClock";
import { Parts } from "./Parts";

/**
 * A03 to A12, server-rendered in their final pose. Motion is in GarageRuntime and globals.css.
 * The box keeps the drawing's proportions, so live HTML can be laid over a blank surface in percentages
 * and sized in container units: it scales with the object.
 */
function Box({ layout, paths, children, ...data }: { layout: Pick<ObjectLayout, "width" | "height" | "nodes">; paths: IllustrationPaths; children?: ReactNode } & Record<`data-${string}`, string | number>) {
  return (
    <span className="ill-box" style={{ "--ar": Math.round((layout.width / layout.height) * 1000) / 1000 } as CSSProperties} {...data}>
      <Parts layout={layout} paths={paths} />
      {children}
    </span>
  );
}

/** A03. The six numbers are live text on the blank board, three to a row. They repeat the list in the header, so they are hidden from assistive tech. */
export function WhiteboardObject({ values }: { values: string[] }) {
  const layout = whiteboardLayout();
  const rows = Array.from({ length: Math.ceil(values.length / layout.cols) }, (_, row) => values.slice(row * layout.cols, (row + 1) * layout.cols));
  return (
    <Box layout={layout} paths={a03} data-line={layout.line} data-rest={layout.rest.join(",")}>
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
  return <Box layout={botLayout()} paths={a05} />;
}

export function BikeObject() {
  return <Box layout={bikeLayout()} paths={a06} />;
}

export function ChalkObject() {
  return <Box layout={chalkLayout()} paths={a07} />;
}

/** A08. Every goal is in the markup, the first one shows. The runtime tears a page and shows the next. Decorative: the goals are read at the link's target. */
export function CalendarObject({ goals }: { goals: { lift: string; target: string }[] }) {
  const layout = calendarLayout();
  return (
    <Box layout={layout} paths={a08}>
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
  return <Box layout={layout} paths={a09} data-throw={`${layout.into[0] - layout.ball[0]},${layout.into[1] - layout.ball[1]}`} />;
}

export function PhoneObject() {
  return <Box layout={phoneLayout()} paths={a10} />;
}

/** A11. The timer's display is blank in the drawing: the time in Dhaka is text, filled in by the browser. */
export function KitObject({ timeZone, placeholder }: { timeZone: string; placeholder: string }) {
  const layout = kitLayout();
  return (
    <Box layout={layout} paths={a11}>
      <span className="kit-clock" aria-hidden="true" style={boxStyle(layout, layout.display)}>
        <DhakaClock timeZone={timeZone} placeholder={placeholder} />
      </span>
    </Box>
  );
}

/** A12, the lamp and its light. The pull cord is drawn apart, inside the button: see LampCord. */
export function LampObject() {
  return <Box layout={lampLayout()} paths={a12} />;
}

/** The pull cord. It sways around the lamp's hanging point, which lies outside its own drawing. */
export function LampCord() {
  const { cord } = lampLayout();
  return (
    <svg className="ill" viewBox={`0 0 ${cord.width} ${cord.height}`} aria-hidden="true" focusable="false">
      <g data-p="cord-sway" style={{ transformOrigin: `${cord.sway[0]}px ${cord.sway[1]}px` }}>
        <g data-p="cord">
          <Art paths={a12} name={cord.name} />
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
  return <Parts layout={layout()} paths={a12} />;
}
