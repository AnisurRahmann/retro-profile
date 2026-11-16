import type { CSSProperties, ReactNode } from "react";
import { buses, ui } from "@/content";
import { hasArt, ROOM, SCENE, stations } from "@/scene";
import type { Station } from "@/schema";
import { CharacterObject } from "./CharacterObject";
import { RackObject } from "./RackObject";

/** Objects whose art is traced. Everything else is a dashed placeholder at the object's footprint. */
const OBJECTS: Record<string, () => ReactNode> = {
  character: () => <CharacterObject />,
  rack: () => <RackObject categories={buses.map((bus) => bus.name)} />,
};

function StationLabel({ station }: { station: Station }) {
  if (!station.href) {
    // the lamp: its label follows the lights
    const t = ui.topbar;
    return (
      <span className="station-label">
        <b className="when-light">{t.lightsOn}</b>
        <b className="when-dark">{t.lightsOut}</b>
        <span className="plain when-light">{t.lightsOnPlain}</span>
        <span className="plain when-dark">{t.lightsOutPlain}</span>
        <span className="sr-only">. {t.lightsAria}</span>
      </span>
    );
  }
  return (
    <span className="station-label">
      <b>{station.label}</b>
      <span className="plain">{station.plain}</span>
    </span>
  );
}

function StationItem({ station }: { station: Station }) {
  const render = hasArt(station) ? OBJECTS[station.id] : undefined;
  const style = { "--x": station.x, "--y": station.y, "--w": station.w, "--h": station.h, "--z": station.z } as CSSProperties;
  const body = (
    <>
      <span className="station-obj">{render ? render() : null}</span>
      <StationLabel station={station} />
    </>
  );
  const shared = { className: "station", "data-station": station.id, "data-art": render ? "svg" : "pending", style };
  if (!station.href) {
    return (
      <button type="button" {...shared} className="station js-only" data-lights-toggle>
        {body}
      </button>
    );
  }
  return (
    <a href={station.href} {...shared}>
      {body}
    </a>
  );
}

/** The room. Backdrop is inline SVG and CSS, every object is a link, DOM order is section order. */
export function Scene() {
  const g = ui.garage;
  const { bandY, floorY, platform } = ROOM;
  return (
    <section className="garage" aria-labelledby="h-garage">
      <div className="wrap garage-head">
        <h2 id="h-garage" className="label">
          <b>{g.sceneLabel}</b> <span className="plain">{g.scenePlain}</span>
        </h2>
        <a href="#section-list" className="btn btn-sm">
          {g.skip}
        </a>
      </div>
      <div className="garage-frame">
        <div className="garage-room" role="group" aria-label={g.sceneAria} data-garage>
          <svg className="garage-backdrop" viewBox={`0 0 ${SCENE.width} ${SCENE.height}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <rect className="room-wall" width={SCENE.width} height={bandY} />
            <rect className="room-band" y={bandY} width={SCENE.width} height={SCENE.height - bandY} />
            <rect className="room-line" y={floorY - 2} width={SCENE.width} height={4} />
            <rect className="room-line" x={platform.x - 4} y={platform.y - 4} width={platform.w + 8} height={platform.h + 8} />
            <rect className="room-platform" x={platform.x} y={platform.y} width={platform.w} height={platform.h} />
          </svg>
          {stations.map((station) => (
            <StationItem key={station.id} station={station} />
          ))}
        </div>
      </div>
      <p className="wrap label garage-note">{g.pending}</p>
    </section>
  );
}
