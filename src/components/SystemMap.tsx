"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import type { Ui } from "@/content";
import type { Bus, Project, Status } from "@/content.schema";
import { seedFrom, wobblyEllipse } from "@/lib/handdrawn";
import { layoutMap, wrapLabel, type MapNode } from "@/lib/mapLayout";
import { highlightProject, openProject } from "@/lib/store";

type Props = {
  projects: Project[];
  buses: Bus[];
  statuses: Status[];
  copy: Ui["map"];
};

/**
 * FIG. 2. Every project as a node on one of six bus rails.
 * Desktop: one schematic. Below 1000px: the same data as a vertical bus list.
 */
export default function SystemMap({ projects, buses, statuses, copy }: Props) {
  const layout = useMemo(
    () =>
      layoutMap(
        projects,
        buses.map((b) => b.id),
      ),
    [projects, buses],
  );
  const byId = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const statusLabel = useMemo(() => new Map(statuses.map((s) => [s.id, s.label])), [statuses]);
  const busLabel = useMemo(() => new Map(buses.map((b) => [b.id, b.label])), [buses]);
  const [active, setActive] = useState(layout.nodes[0]?.id ?? "");

  const move = (from: MapNode, dRow: number, dCol: number) => {
    const row = Math.max(0, Math.min(layout.rows.length - 1, from.row + dRow));
    const inRow = layout.nodes.filter((n) => n.row === row);
    const col = Math.max(0, Math.min(inRow.length - 1, from.col + dCol));
    const next = inRow.find((n) => n.col === col);
    if (!next) return;
    setActive(next.id);
    document.getElementById(`map-node-${next.id}`)?.focus();
  };

  const onKey = (e: KeyboardEvent<SVGGElement>, node: MapNode) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openProject(node.id);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      move(node, 0, 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      move(node, 0, -1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      move(node, 1, 0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      move(node, -1, 0);
    }
  };

  const aria = (p: Project) => `${copy.open} ${p.id} ${p.name}, ${statusLabel.get(p.status) ?? ""}`;
  const hover = (id: string | null) => () => highlightProject(id);

  return (
    <div className="map-wrap">
      <svg
        className="map-svg"
        viewBox={`-14 -6 ${layout.width + 20} ${layout.height + 10}`}
        role="group"
        aria-label={copy.alt}
        data-map=""
      >
        {layout.rows.map((row, i) => (
          <g key={row.bus}>
            <text className="map-busno" x={0} y={row.railY - 9}>
              {copy.bus} {i + 1}
            </text>
            <text className="map-buslabel" x={0} y={row.railY + 4}>
              {busLabel.get(row.bus)}
            </text>
            <line
              className="map-rail"
              x1={row.railX0}
              y1={row.railY}
              x2={row.railX1}
              y2={row.railY}
            />
          </g>
        ))}

        <g className="map-wires">
          {layout.wires.map((w) => (
            <polyline
              key={`${w.a}-${w.b}`}
              className="map-wire"
              data-wire={`${w.a} ${w.b}`}
              points={w.points.map((p) => p.join(",")).join(" ")}
            />
          ))}
          {layout.junctions.map(([x, y], i) => (
            <rect key={i} className="map-dot" x={x - 2.5} y={y - 2.5} width={5} height={5} />
          ))}
        </g>

        <g className="map-stubs">
          {layout.nodes.map((n) => (
            <g key={n.id} data-pid={n.id} data-near={n.near.join(" ")}>
              <line className="map-stub" x1={n.stubX} y1={n.railY} x2={n.stubX} y2={n.y} />
              <circle className="map-dot" cx={n.stubX} cy={n.railY} r={4} />
            </g>
          ))}
        </g>

        {layout.nodes.map((n) => {
          const p = byId.get(n.id);
          if (!p) return null;
          const lines = wrapLabel(p.name);
          return (
            <g
              key={n.id}
              id={`map-node-${n.id}`}
              className="map-node"
              data-pid={n.id}
              data-near={n.near.join(" ")}
              data-status={p.status}
              role="button"
              tabIndex={n.id === active ? 0 : -1}
              aria-label={aria(p)}
              onClick={() => openProject(n.id)}
              onKeyDown={(e) => onKey(e, n)}
              onPointerEnter={hover(n.id)}
              onPointerLeave={hover(null)}
              onFocus={() => {
                setActive(n.id);
                highlightProject(n.id);
              }}
              onBlur={hover(null)}
            >
              <rect
                className="shape"
                data-status={p.status}
                x={n.x}
                y={n.y}
                width={n.w}
                height={n.h}
              />
              {p.status === "IN_BUILD" && (
                <rect className="shape-hatch" x={n.x} y={n.y} width={n.w} height={n.h} />
              )}
              {p.status === "BUILT" && (
                <rect
                  className="shape-inner"
                  x={n.x + 4}
                  y={n.y + 4}
                  width={n.w - 8}
                  height={n.h - 8}
                />
              )}
              <rect
                className="map-plate"
                x={n.x + 7}
                y={n.y + 7}
                width={n.w - 14}
                height={n.h - 14}
              />
              <text className="map-id" x={n.x + 11} y={n.y + 19}>
                {n.id}
              </text>
              {lines.map((line, i) => (
                <text key={i} className="map-name" x={n.x + 11} y={n.y + 33 + i * 12.5}>
                  {line}
                </text>
              ))}
              <rect
                className="map-focus"
                x={n.x - 5}
                y={n.y - 5}
                width={n.w + 10}
                height={n.h + 10}
              />
            </g>
          );
        })}

        <g className="redline" aria-hidden="true">
          {layout.nodes.map((n, i) => {
            const p = byId.get(n.id);
            if (!p?.redlineTag) return null;
            const delay = { "--d": `${0.8 + (i % 9) * 0.07}s` } as React.CSSProperties;
            return (
              <g key={n.id}>
                <path
                  className="rl-stroke draw"
                  pathLength={1}
                  style={delay}
                  d={wobblyEllipse(n.x + 29, n.y + 14.5, 26, 9, seedFrom(n.id))}
                />
                <text className="map-tag" x={n.stubX + 9} y={n.railY + 21}>
                  {p.redlineTag}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      <div className="map-list" aria-label={copy.listLabel} role="group">
        {buses.map((bus, i) => (
          <section className="bus" key={bus.id}>
            <h3 className="label label--ink">
              <span className="muted">
                {copy.bus} {i + 1}
              </span>
              {bus.label}
            </h3>
            <ul>
              {projects
                .filter((p) => p.bus === bus.id)
                .map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="bus-node"
                      data-pid={p.id}
                      data-status={p.status}
                      aria-label={aria(p)}
                      onClick={() => openProject(p.id)}
                    >
                      {p.status === "IN_BUILD" && (
                        <svg aria-hidden="true" focusable="false">
                          <rect width="100%" height="100%" fill="url(#ds-hatch)" opacity="0.55" />
                        </svg>
                      )}
                      <span className="mono label label--ink">{p.id}</span>
                      <span className="bus-name">{p.name}</span>
                      <span className="label bus-meta">{statusLabel.get(p.status)}</span>
                      {p.redlineTag && (
                        <span className="hand redline" aria-hidden="true">
                          {p.redlineTag}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
