"use client";

import { Fragment, useMemo, useState } from "react";
import type { Ui } from "@/content";
import type { Bus, BusId, Project, Status, StatusId } from "@/content.schema";
import { highlightProject, openProject } from "@/lib/store";
import { Swatch } from "./marks";

type SortKey = "id" | "name" | "bus" | "status";
type Props = { projects: Project[]; buses: Bus[]; statuses: Status[]; copy: Ui["register"] };

const SORT_KEYS: SortKey[] = ["id", "name", "bus", "status"];

/** Sheet 04: the project register, styled as a bill of materials. */
export default function Register({ projects, buses, statuses, copy }: Props) {
  const [bus, setBus] = useState<BusId | null>(null);
  const [status, setStatus] = useState<StatusId | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "id", dir: 1 });
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());

  const busLabel = useMemo(() => new Map(buses.map((b) => [b.id, b.label])), [buses]);
  const statusLabel = useMemo(() => new Map(statuses.map((s) => [s.id, s.label])), [statuses]);

  const rows = useMemo(() => {
    const busRank = new Map(buses.map((b, i) => [b.id, i]));
    const statusRank = new Map(statuses.map((s, i) => [s.id, i]));
    const value = (p: Project): string | number => {
      if (sort.key === "bus") return busRank.get(p.bus) ?? 0;
      if (sort.key === "status") return statusRank.get(p.status) ?? 0;
      return sort.key === "name" ? p.name.toLowerCase() : p.id;
    };
    return projects
      .filter((p) => (!bus || p.bus === bus) && (!status || p.status === status))
      .sort((a, b) => {
        const va = value(a);
        const vb = value(b);
        const cmp = va < vb ? -1 : va > vb ? 1 : a.id.localeCompare(b.id);
        return cmp * sort.dir;
      });
  }, [projects, buses, statuses, bus, status, sort]);

  const sortBy = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  const ariaSort = (key: SortKey) =>
    sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none";
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div>
      <div className="reg-tools">
        <div className="reg-filter" role="group" aria-label={copy.filterBus}>
          <span className="label">{copy.filterBus}</span>
          <button
            type="button"
            className="chip"
            aria-pressed={bus === null}
            onClick={() => setBus(null)}
          >
            {copy.all}
          </button>
          {buses.map((b) => (
            <button
              key={b.id}
              type="button"
              className="chip"
              aria-pressed={bus === b.id}
              onClick={() => setBus(bus === b.id ? null : b.id)}
            >
              {b.label}
            </button>
          ))}
        </div>
        <div className="reg-filter" role="group" aria-label={copy.filterStatus}>
          <span className="label">{copy.filterStatus}</span>
          <button
            type="button"
            className="chip"
            aria-pressed={status === null}
            onClick={() => setStatus(null)}
          >
            {copy.all}
          </button>
          {statuses.map((s) => (
            <button
              key={s.id}
              type="button"
              className="chip"
              aria-pressed={status === s.id}
              onClick={() => setStatus(status === s.id ? null : s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="reg-filter reg-sort" role="group" aria-label={copy.sortBy}>
          <span className="label">{copy.sortBy}</span>
          {SORT_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              className="chip"
              aria-pressed={sort.key === key}
              onClick={() => sortBy(key)}
            >
              {copy.cols[key]}
            </button>
          ))}
        </div>
      </div>

      <div className="reg-wrap">
        <table className="reg" data-register="">
          <caption className="label label--ink">{copy.caption}</caption>
          <thead>
            <tr>
              {SORT_KEYS.map((key) => (
                <th key={key} scope="col" aria-sort={ariaSort(key)}>
                  <button type="button" onClick={() => sortBy(key)}>
                    {copy.cols[key]}
                  </button>
                </th>
              ))}
              <th scope="col">{copy.cols.stack}</th>
              <th scope="col" className="reg-next">
                {copy.cols.next}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const expanded = open.has(p.id);
              return (
                <Fragment key={p.id}>
                  <tr
                    className="reg-row"
                    data-pid={p.id}
                    onPointerEnter={() => highlightProject(p.id)}
                    onPointerLeave={() => highlightProject(null)}
                  >
                    <td className="reg-id">
                      <button
                        type="button"
                        aria-expanded={expanded}
                        aria-controls={`reg-detail-${p.id}`}
                        aria-label={`${copy.expand} ${p.id} ${p.name}`}
                        onClick={() => toggle(p.id)}
                      >
                        {p.id}
                      </button>
                    </td>
                    <td className="reg-name">{p.name}</td>
                    <td className="reg-bus">{busLabel.get(p.bus)}</td>
                    <td className="reg-status">
                      <span>
                        <Swatch status={p.status} />
                        {statusLabel.get(p.status)}
                      </span>
                    </td>
                    <td className="reg-stack">{p.stack.length > 0 ? p.stack.join(", ") : "—"}</td>
                    <td className="reg-next" data-empty={p.redline ? undefined : ""}>
                      {p.redline ?? "—"}
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="reg-detail" id={`reg-detail-${p.id}`}>
                      <td colSpan={6}>
                        <p>{p.oneLiner}</p>
                        {p.detail && <p className="muted">{p.detail}</p>}
                        <button type="button" className="btn" onClick={() => openProject(p.id)}>
                          {copy.openSheet}
                        </button>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="reg-empty">
            <p>{copy.empty}</p>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setBus(null);
                setStatus(null);
              }}
            >
              {copy.reset}
            </button>
          </div>
        )}
        <p className="label reg-foot" aria-live="polite">
          <span>
            {copy.showing}: {rows.length} / {projects.length}
          </span>
        </p>
      </div>
    </div>
  );
}
