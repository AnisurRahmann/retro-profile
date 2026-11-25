import clsx from "clsx";
import { monogram, tileColour } from "@/lib/glyph";

export function Tile({ id, title, small = false }: { id: string; title: string; small?: boolean }) {
  return (
    <span aria-hidden="true" className={clsx("tile", `tile-${tileColour(id)}`, small && "tile--sm")}>
      {monogram(title)}
    </span>
  );
}
