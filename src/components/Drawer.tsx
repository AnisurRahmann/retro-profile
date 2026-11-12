"use client";

import { useEffect, useRef } from "react";
import type { Ui } from "@/content";
import type { Bus, Project, Status } from "@/content.schema";
import { closeProject, openProject, useSelectedProject } from "@/lib/store";
import { Stamp } from "./marks";

type Props = {
  projects: Project[];
  buses: Bus[];
  statuses: Status[];
  copy: Ui["drawer"];
  external: string;
};

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Right-side detail sheet for one project. Modal: traps focus, Escape closes, focus returns to the opener. */
export function Drawer({ projects, buses, statuses, copy, external }: Props) {
  const id = useSelectedProject();
  const project = id ? projects.find((p) => p.id === id) : undefined;
  const panel = useRef<HTMLElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const isOpen = Boolean(project);

  useEffect(() => {
    if (!isOpen) return;
    opener.current = document.activeElement as HTMLElement | null;
    const root = document.documentElement;
    const prevOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>("[data-close]")?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeProject();
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      const current = document.activeElement;
      if (!panel.current.contains(current)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && current === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && current === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      root.style.overflow = prevOverflow;
      const back = opener.current;
      if (back && back.isConnected) back.focus({ preventScroll: true });
    };
  }, [isOpen]);

  if (!project) return null;
  const status = statuses.find((s) => s.id === project.status);
  const bus = buses.find((b) => b.id === project.bus);
  const wired = project.connectsTo
    .map((pid) => projects.find((p) => p.id === pid))
    .filter((p): p is Project => Boolean(p));

  return (
    <>
      <div className="drawer-veil" onClick={closeProject} />
      <aside
        ref={panel}
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        data-drawer=""
      >
        <header>
          <span className="label label--ink">
            {copy.title} · {project.id}
          </span>
          <button type="button" className="chip" data-close="" onClick={closeProject}>
            {copy.close}
          </button>
        </header>
        <div className="drawer-scroll" key={project.id}>
          <p className="label">
            {copy.bus}: {bus?.label}
          </p>
          <h2 id="drawer-title" className="display">
            {project.name}
          </h2>
          <div className="drawer-status">
            <span className="label">{status?.meaning}</span>
            {status && <Stamp status={status} />}
          </div>
          <dl>
            <div>
              <dt className="label">{copy.description}</dt>
              <dd>{project.oneLiner}</dd>
            </div>
            {project.detail && (
              <div>
                <dt className="label">{copy.detail}</dt>
                <dd>{project.detail}</dd>
              </div>
            )}
            {project.stack.length > 0 && (
              <div>
                <dt className="label">{copy.stack}</dt>
                <dd>
                  <ul>
                    {project.stack.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
            {project.install && (
              <div>
                <dt className="label">
                  {copy.install}
                  {project.version ? ` · ${copy.version} ${project.version}` : ""}
                </dt>
                <dd>
                  {project.install.map((cmd) => (
                    <code key={cmd}>{cmd}</code>
                  ))}
                </dd>
              </div>
            )}
            <div>
              <dt className="label">{copy.links}</dt>
              <dd>
                {project.link ? (
                  <a href={project.link.href} target="_blank" rel="noreferrer" className="mono">
                    {project.link.display}
                    <span className="sr-only"> ({external})</span>
                  </a>
                ) : (
                  <span className="muted">{copy.noLink}</span>
                )}
              </dd>
            </div>
            {wired.length > 0 && (
              <div>
                <dt className="label">{copy.connects}</dt>
                <dd className="drawer-refs">
                  {wired.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="pref"
                      onClick={() => openProject(p.id)}
                    >
                      <span>
                        {p.id} {p.name}
                      </span>
                    </button>
                  ))}
                </dd>
              </div>
            )}
          </dl>
          {project.redline && (
            <div className="drawer-redline redline">
              <span className="label">{copy.redline}</span>
              <p className="hand">{project.redline}</p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
