import type { CSSProperties } from "react";

export type PlateFace = { id: string; bus: string; stamp: string; color: string; status: string };

/** The inside of a face-on plate: id, centre hole, category stamp. Wrap it in a link or a button. */
export function PlateFaceContent({ plate }: { plate: PlateFace }) {
  return (
    <>
      <span className="plate-id">{plate.id}</span>
      <span className="plate-hole" />
      <span className="plate-stamp">{plate.stamp}</span>
    </>
  );
}

export function plateAttrs(plate: PlateFace) {
  return {
    className: "plate",
    "data-bus": plate.bus,
    "data-size": plate.status,
    "data-plate-id": plate.id,
    style: { "--plate": plate.color } as CSSProperties,
  };
}
