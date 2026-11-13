"use client";

import { useMemo, useState, type CSSProperties } from "react";
import type { PlateData } from "./ltb-types";

export type RegisterCopy = {
  columns: { id: string; name: string; category: string; status: string; stack: string; next: string };
  filterCategory: string;
  filterStatus: string;
  all: string;
  showing: string;
  reset: string;
  detail: string;
  none: string;
  connects: string;
  install: string;
  version: string;
};

type SortKey = "id" | "name" | "category" | "status";

/** The plain table of all projects: server-rendered source of truth, with filters and sorting layered on. */
export function Register({
  rows,
  buses,
  statuses,
  copy,
}: {
  rows: PlateData[];
  buses: { id: string; name: string }[];
  statuses: { id: string; name: string; plain: string }[];
  copy: RegisterCopy;
}) {
  const [bus, setBus] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "id", dir: 1 });

  const busOrder = useMemo(() => new Map(buses.map((entry, index) => [entry.id, index])), [buses]);
  const names = useMemo(() => new Map(rows.map((row) => [row.id, row.name])), [rows]);

  const visible = useMemo(() => {
    const filtered = rows.filter((row) => (bus === "all" || row.bus === bus) && (status === "all" || row.status === status));
    const value = (row: PlateData): string | number => {
      if (sort.key === "name") return row.name.toLowerCase();
      if (sort.key === "category") return busOrder.get(row.bus) ?? 0;
      if (sort.key === "status") return row.statusRank;
      return row.id;
    };
    return [...filtered].sort((a, b) => {
      const left = value(a);
      const right = value(b);
      const order = left < right ? -1 : left > right ? 1 : a.id.localeCompare(b.id);
      return order * sort.dir;
    });
  }, [rows, bus, status, sort, busOrder]);

  const header = (key: SortKey, label: string) => (
    <th scope="col" aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        data-sort={key}
        onClick={() => setSort((previous) => ({ key, dir: previous.key === key && previous.dir === 1 ? -1 : 1 }))}
      >
        {label}
        <span aria-hidden="true">{sort.key === key ? (sort.dir === 1 ? "▲" : "▼") : ""}</span>
      </button>
    </th>
  );

  return (
    <div>
      <div className="js-only no-print">
        <div className="flex flex-wrap items-end gap-3 border-b-2 border-iron p-3">
          <label className="grid min-w-0 max-w-full gap-1">
            <span className="label steel">{copy.filterCategory}</span>
            <select className="field" value={bus} onChange={(event) => setBus(event.target.value)} data-filter="bus">
              <option value="all">{copy.all}</option>
              {buses.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid min-w-0 max-w-full gap-1">
            <span className="label steel">{copy.filterStatus}</span>
            <select className="field" value={status} onChange={(event) => setStatus(event.target.value)} data-filter="status">
              <option value="all">{copy.all}</option>
              {statuses.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name} ({entry.plain})
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setBus("all");
              setStatus("all");
              setSort({ key: "id", dir: 1 });
            }}
          >
            {copy.reset}
          </button>
          <p className="label ml-auto self-center" role="status" data-showing>
            <b>
              {copy.showing} {visible.length} / {rows.length}
            </b>
          </p>
        </div>
      </div>
      <table className="register">
        <thead>
          <tr>
            {header("id", copy.columns.id)}
            {header("name", copy.columns.name)}
            {header("category", copy.columns.category)}
            {header("status", copy.columns.status)}
            <th scope="col">
              <span>{copy.columns.stack}</span>
            </th>
            <th scope="col">
              <span>{copy.columns.next}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => (
            <tr key={row.id} id={`reg-${row.id}`} data-row={row.id} data-bus={row.bus}>
              <td className="mono whitespace-nowrap font-semibold">{row.id}</td>
              <td style={{ minWidth: "16rem" }}>
                <span className="display block text-2xl">{row.name}</span>
                <span className="mt-1 block">{row.oneLiner}</span>
                {row.link ? (
                  <a href={row.link.href} className="mono mt-1 block break-all">
                    {row.link.label}
                  </a>
                ) : null}
                {row.detail || row.install || row.connectsTo.length > 0 ? (
                  <details className="mt-1" data-print-open>
                    <summary className="label steel">{copy.detail}</summary>
                    {row.detail ? <p className="steel mt-1">{row.detail}</p> : null}
                    {row.install ? (
                      <p className="mono mt-1">
                        <span className="label steel block">
                          {copy.install}
                          {row.version ? ` · ${copy.version} ${row.version}` : ""}
                        </span>
                        {row.install.map((line) => (
                          <code key={line} className="block break-all">
                            {line}
                          </code>
                        ))}
                      </p>
                    ) : null}
                    {row.connectsTo.length > 0 ? (
                      <p className="mono mt-1">
                        <span className="label steel">{copy.connects}</span>{" "}
                        {row.connectsTo.map((id, index) => (
                          <span key={id}>
                            {index > 0 ? ", " : ""}
                            <a href={`#reg-${id}`}>
                              {id} {names.get(id)}
                            </a>
                          </span>
                        ))}
                      </p>
                    ) : null}
                  </details>
                ) : null}
              </td>
              <td data-label={copy.columns.category}>
                <span className="label flex items-center gap-2 whitespace-nowrap">
                  <span className="swatch" data-bus={row.bus} style={{ "--plate": row.color } as CSSProperties} />
                  {row.busName}
                </span>
              </td>
              <td data-label={copy.columns.status}>
                <span className="lights" data-status={row.status}>
                  <span className="lightbox" aria-hidden="true">
                    {row.lights.map((state, index) => (
                      <i key={index} className="light" data-s={state} />
                    ))}
                  </span>
                  <span className="label">
                    <b>{row.statusCall}</b> <span className="plain">{row.statusPlain}</span>
                  </span>
                </span>
              </td>
              <td className="mono" data-label={row.stack ? copy.columns.stack : undefined}>
                {row.stack?.join(" · ")}
              </td>
              <td data-label={row.next ? copy.columns.next : undefined}>{row.next}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {visible.length === 0 ? <p className="mono steel p-4">{copy.none}</p> : null}
    </div>
  );
}
