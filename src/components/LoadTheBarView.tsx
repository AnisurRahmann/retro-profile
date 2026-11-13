import type { CSSProperties, PointerEvent as ReactPointerEvent, Ref } from "react";
import { Barbell } from "./Barbell";
import type { LtbData, PlateData } from "./ltb-types";
import { PlateFaceContent, plateAttrs } from "./Plate";

/**
 * Presentational Load the Bar. Rendered on the server with no handlers (plates are links into the register),
 * then re-rendered by the game with handlers once its chunk has loaded.
 */
export type LtbHandlers = {
  onPlate: (id: string) => void;
  onSelect: (id: string) => void;
  onUnload: (id: string) => void;
  onStrip: () => void;
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>, id: string) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLButtonElement>) => void;
};

type Props = LtbData & {
  loaded?: string[];
  selected?: string | null;
  over?: boolean;
  goodLift?: boolean;
  announcement?: string;
  /** ids restored from storage: seated without the slide */
  instant?: boolean;
  dropRef?: Ref<HTMLDivElement>;
  handlers?: LtbHandlers;
};

function LightsInline({ plate }: { plate: PlateData }) {
  return (
    <span className="lights">
      <span className="lightbox" aria-hidden="true">
        {plate.lights.map((state, index) => (
          <i key={index} className="light" data-s={state} style={{ "--i": index } as CSSProperties} />
        ))}
      </span>
      <span className="label">
        <b>{plate.statusCall}</b> <span className="plain">{plate.statusPlain}</span>
      </span>
    </span>
  );
}

export function LoadTheBarView({
  plates,
  pegs,
  sizes,
  copy,
  loaded = [],
  selected = null,
  over = false,
  goodLift = false,
  announcement = "",
  instant = false,
  dropRef,
  handlers,
}: Props) {
  const byId = new Map(plates.map((plate) => [plate.id, plate]));
  const loadedSet = new Set(loaded);
  const current = selected ? byId.get(selected) : undefined;
  const sag = Math.min(22, Math.max(0, 2 * loaded.length));

  const edge = (id: string) => {
    const plate = byId.get(id);
    if (!plate) return null;
    return (
      <button
        key={id}
        type="button"
        className="eplate"
        data-bus={plate.bus}
        data-size={plate.status}
        data-slide={instant ? undefined : ""}
        data-selected={selected === id ? "" : undefined}
        data-loaded-id={id}
        style={{ "--plate": plate.color } as CSSProperties}
        aria-label={`${plate.id} ${plate.name}, ${plate.busName}`}
        onClick={() => handlers?.onSelect(id)}
      />
    );
  };

  return (
    <div className="ltb-game mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-start">
      {/* plate rack */}
      <div className="panel" data-rack>
        <p className="label flex flex-wrap justify-between gap-2 border-b-2 border-iron p-3">
          <span>
            <b>{copy.rack}</b> <span className="plain">{copy.rackPlain}</span>
          </span>
          <span className="steel">
            {copy.colorLegend} <span className="plain">{copy.colorLegendPlain}</span>
          </span>
        </p>
        {pegs.map((peg) => (
          <div key={peg.bus} className="rack-peg" data-peg={peg.bus}>
            <p className="label flex items-center gap-2">
              <span className="swatch" data-bus={peg.bus} style={{ "--plate": peg.color } as CSSProperties} />
              <b>{peg.name}</b>
              <span className="steel">{peg.ids.length}</span>
            </p>
            <ul className="rack-plates">
              {peg.ids.map((id) => {
                const plate = byId.get(id);
                if (!plate) return null;
                const isLoaded = loadedSet.has(id);
                return (
                  <li key={id} className="rack-item">
                    <span className="rack-slot">
                    {handlers ? (
                      <button
                        type="button"
                        {...plateAttrs(plate)}
                        aria-pressed={isLoaded}
                        aria-label={`${plate.id} ${plate.name}. ${plate.busName}. ${plate.statusCall}, ${plate.statusPlain}.`}
                        data-selected={selected === id ? "" : undefined}
                        onClick={() => handlers.onPlate(id)}
                        onPointerDown={(event) => handlers.onPointerDown(event, id)}
                        onPointerMove={handlers.onPointerMove}
                        onPointerUp={handlers.onPointerUp}
                        onPointerCancel={handlers.onPointerCancel}
                      >
                        <PlateFaceContent plate={plate} />
                      </button>
                    ) : (
                      <a
                        href={`#reg-${plate.id}`}
                        {...plateAttrs(plate)}
                        aria-label={`${plate.id} ${plate.name}. ${plate.busName}. ${plate.statusCall}, ${plate.statusPlain}.`}
                      >
                        <PlateFaceContent plate={plate} />
                      </a>
                    )}
                    </span>
                    <span className="rack-name" aria-hidden="true">
                      {plate.name}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        <div className="border-t-2 border-iron p-3">
          <p className="label steel">
            {copy.sizeLegend} <span className="plain">{copy.sizeLegendPlain}</span>
          </p>
          <ul className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-2">
            {sizes.map((size) => (
              <li key={size.id} className="flex items-center gap-2">
                <span
                  className="plate plate-neutral"
                  data-size={size.id}
                  aria-hidden="true"
                  style={{ "--d": `${(legendRem(size.id) * 0.42).toFixed(2)}rem` } as CSSProperties}
                />
                <span className="label">
                  {size.name} <span className="plain">{size.plain}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* bar and detail card */}
      <div className="ltb-side grid gap-4 lg:sticky lg:top-[4.25rem]">
        <div className="panel dropzone" data-dropzone data-over={over ? "" : undefined} ref={dropRef}>
          <p className="label flex flex-wrap items-center justify-between gap-2 border-b-2 border-iron p-3">
            <span>
              <b>{copy.bar}</b> <span className="plain">{copy.barPlain}</span>
            </span>
            <span data-counter>
              <b>
                {copy.loaded} {loaded.length} / {plates.length}
              </b>
            </span>
          </p>
          <div className="px-2">
            <Barbell
              className="ltb-bar"
              sag={sag}
              label={copy.barAria}
              left={loaded.filter((_, index) => index % 2 === 0).map(edge)}
              right={loaded.filter((_, index) => index % 2 === 1).map(edge)}
            />
          </div>
          {goodLift ? (
            <p className="goodlift flex flex-wrap items-center gap-3 p-3" data-goodlift>
              <span className="lightbox" aria-hidden="true">
                <i className="light" data-s="on" />
                <i className="light" data-s="on" />
                <i className="light" data-s="on" />
              </span>
              <span className="display text-3xl">{copy.goodLift}</span>
              <span className="plain">{copy.goodLiftPlain}</span>
            </p>
          ) : null}
          <div className="flex flex-wrap items-start justify-between gap-3 border-t-2 border-iron p-3">
            <div className="min-w-0 flex-1">
              <p className="label steel">{copy.onBar}</p>
              {loaded.length === 0 ? (
                <p className="mono steel mt-1">{copy.emptyBar}</p>
              ) : (
                <ol className="mt-1 flex flex-wrap gap-1.5">
                  {loaded.map((id) => {
                    const plate = byId.get(id);
                    if (!plate) return null;
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          className="btn btn-sm gap-1.5 normal-case"
                          aria-current={selected === id ? "true" : undefined}
                          onClick={() => handlers?.onSelect(id)}
                        >
                          <span className="swatch" data-bus={plate.bus} style={{ "--plate": plate.color } as CSSProperties} />
                          {plate.name}
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
            {handlers ? (
              <button type="button" className="btn btn-sm" onClick={handlers.onStrip} disabled={loaded.length === 0} data-strip>
                {copy.strip} <span className="plain">{copy.stripPlain}</span>
              </button>
            ) : null}
          </div>
        </div>

        <article className="panel p-4" data-detail aria-live="off">
          {current ? (
            <>
              <p className="label flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span className="swatch" data-bus={current.bus} style={{ "--plate": current.color } as CSSProperties} />
                  <b>{current.id}</b> · {current.busName}
                </span>
                <LightsInline plate={current} />
              </p>
              <h3 className="display mt-3 text-4xl md:text-5xl" data-detail-name>
                {current.name}
              </h3>
              <p className="mt-3 font-semibold">{current.oneLiner}</p>
              {current.detail ? <p className="steel mt-2">{current.detail}</p> : null}
              <dl className="mt-4 grid gap-3">
                {current.stack ? (
                  <div>
                    <dt className="label steel">{copy.stack}</dt>
                    <dd className="mono">{current.stack.join(" · ")}</dd>
                  </div>
                ) : null}
                {current.install ? (
                  <div>
                    <dt className="label steel">
                      {copy.install}
                      {current.version ? ` · ${copy.version} ${current.version}` : ""}
                    </dt>
                    <dd className="mono">
                      {current.install.map((line) => (
                        <code key={line} className="block break-all">
                          {line}
                        </code>
                      ))}
                    </dd>
                  </div>
                ) : null}
                {current.link ? (
                  <div>
                    <dt className="label steel">{copy.link}</dt>
                    <dd className="mono">
                      <a href={current.link.href} className="break-all">
                        {current.link.label}
                      </a>
                    </dd>
                  </div>
                ) : null}
                {current.next ? (
                  <div className="border-t-2 border-iron pt-3">
                    <dt className="label">
                      <b>{copy.next}</b> <span className="plain">{copy.nextPlain}</span>
                    </dt>
                    <dd>{current.next}</dd>
                  </div>
                ) : null}
                {current.connectsTo.length > 0 ? (
                  <div>
                    <dt className="label steel">{copy.connects}</dt>
                    <dd className="mt-1 flex flex-wrap gap-1.5">
                      {current.connectsTo.map((id) => (
                        <button key={id} type="button" className="btn btn-sm normal-case" onClick={() => handlers?.onPlate(id)}>
                          {id} {byId.get(id)?.name}
                        </button>
                      ))}
                    </dd>
                  </div>
                ) : null}
              </dl>
              <p className="mt-4 flex flex-wrap gap-2">
                {loadedSet.has(current.id) ? (
                  <button type="button" className="btn btn-sm" onClick={() => handlers?.onUnload(current.id)} data-unload>
                    {copy.unload}
                  </button>
                ) : null}
                <a href={`#reg-${current.id}`} className="btn btn-sm">
                  {copy.inRegister}
                </a>
              </p>
            </>
          ) : (
            <>
              <h3 className="display steel text-4xl">{copy.emptyTitle}</h3>
              <p className="steel mt-2">{copy.emptyHint}</p>
            </>
          )}
        </article>
        <p className="sr-only" role="status" aria-live="polite" data-ltb-live>
          {announcement}
        </p>
      </div>
    </div>
  );
}

function legendRem(size: string): number {
  return { shipped: 5.75, built: 5.125, "in-build": 4.5, specd: 3.875, idea: 3.375 }[size] ?? 4.5;
}
