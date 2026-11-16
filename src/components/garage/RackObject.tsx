import type { CSSProperties } from "react";
import { rackLayout } from "@/illustrations/compose";
import { a02 } from "@/illustrations/generated/a02";
import { Art, at } from "./Art";

/**
 * A02. Server-rendered in its final state: bar on the hooks, six plates a side, red innermost.
 * `categories` are the six project categories in plate order, each plate carries its name as a <title>.
 * The runtime slides the plates in once and swaps the bar on hover: see GarageRuntime.
 */
export function RackObject({ categories }: { categories: string[] }) {
  const layout = rackLayout();
  return (
    <svg className="ill" viewBox={`0 0 ${layout.width} ${layout.height}`} aria-hidden="true" focusable="false">
      <g transform={at(layout.rack)}>
        <Art paths={a02} name={layout.rack.name} />
      </g>
      <g data-rk="load">
        <g data-rk="straight">
          <g transform={at(layout.straight)}>
            <Art paths={a02} name={layout.straight.name} />
          </g>
        </g>
        <g data-rk="bowed">
          <g transform={at(layout.bowed)}>
            <Art paths={a02} name={layout.bowed.name} />
          </g>
        </g>
        {layout.plates.map((plate) => (
          <g key={`${plate.side}${plate.index}`} data-rk="plate" data-side={plate.side} data-colour={plate.colour} style={{ "--i": plate.index } as CSSProperties}>
            <title>{categories[plate.index]}</title>
            <g transform={at(plate)}>
              <Art paths={a02} name={plate.name} />
            </g>
          </g>
        ))}
      </g>
    </svg>
  );
}
