import type { CSSProperties, ReactNode } from "react";
import { buses, goals, metrics, ui } from "@/content";
import { GYM_UI } from "@/gym";
import { decor, hasArt, ROOM, SCENE, stations } from "@/scene";
import type { Station } from "@/schema";
import { CharacterObject } from "./CharacterObject";
import { BikeObject, BinObject, BotObject, CalendarObject, ChalkObject, DecorObject, KitObject, LampCord, lampCordPlace, LampObject, PhoneObject, WhiteboardObject } from "./Objects";
import { RackObject } from "./RackObject";

/** Objects whose art is traced. Everything else is a dashed placeholder at the object's footprint. */
const OBJECTS: Record<string, () => ReactNode> = {
  character: () => <CharacterObject />,
  whiteboard: () => <WhiteboardObject values={metrics.map((metric) => metric.value)} />,
  rack: () => <RackObject categories={buses.map((bus) => bus.name)} />,
  chalk: () => <ChalkObject />,
  calendar: () => <CalendarObject goals={goals.map(({ lift, target }) => ({ lift, target }))} />,
  bin: () => <BinObject />,
  bike: () => <BikeObject />,
  kit: () => <KitObject timeZone={GYM_UI.timeZone} placeholder={ui.garage.clockPlaceholder} />,
  phone: () => <PhoneObject />,
  bot: () => <BotObject />,
  lamp: () => <LampObject />,
};

function StationLabel({ station }: { station: Station }) {
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
  const object = <span className="station-obj">{render ? render() : null}</span>;
  const shared = { "data-station": station.id, "data-art": render ? "svg" : "pending", style };
  if (!station.href) {
    // the lamp is a control, not a link: the pull cord is the button, pressed while the lights are out
    return (
      <div className="station js-only" {...shared}>
        {object}
        <button type="button" className="lamp-cord" data-lights-toggle aria-pressed="false" style={lampCordPlace(station.scale)}>
          <LampCord />
          <StationLabel station={station} />
        </button>
      </div>
    );
  }
  return (
    <a href={station.href} className="station" {...shared}>
      {object}
      <StationLabel station={station} />
    </a>
  );
}

/** The room. Backdrop is inline SVG and CSS, every object is a link, DOM order is section order. */
export function Scene() {
  const g = ui.garage;
  const { bandY, floorY, platform } = ROOM;
  const bot = stations.find((station) => station.id === "bot" && hasArt(station));
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
          {decor.map((item) => (
            <span key={item.id} className="garage-decor" style={{ "--x": item.x, "--y": item.y, "--w": item.w, "--h": item.h, "--z": item.z } as CSSProperties}>
              <DecorObject id={item.id} />
            </span>
          ))}
          {stations.map((station) => (
            <StationItem key={station.id} station={station} />
          ))}
          {/* the bot speaks the plain label of the station in focus. Off for assistive tech: the link already has that name. */}
          {bot ? <span className="bot-say" data-say="" aria-live="off" style={{ "--x": bot.x + 12, "--y": bot.y + 40 } as CSSProperties} /> : null}
        </div>
      </div>
      <p className="wrap label garage-note">{g.pending}</p>
    </section>
  );
}
