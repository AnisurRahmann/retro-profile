import { buses, projects, statusById, ui } from "@/content";
import { counts, flight, projectStatuses, projectsByBus } from "@/lib/derive";
import { busById } from "@/content";
import { LoadTheBarShell } from "./LoadTheBarShell";
import { LoadTheBarView } from "./LoadTheBarView";
import type { LtbData, PlateData } from "./ltb-types";
import { Register } from "./Register";
import { ScoreRow } from "./ScoreRow";

function toPlate(project: (typeof projects)[number]): PlateData {
  const bus = busById(project.bus);
  const status = statusById(project.status);
  return {
    id: project.id,
    name: project.name,
    bus: bus.id,
    busName: bus.name,
    stamp: bus.stamp,
    color: bus.color,
    status: status.id,
    statusName: status.name,
    statusCall: status.call,
    statusPlain: status.plain,
    statusRank: status.rank,
    lights: status.lights,
    oneLiner: project.oneLiner,
    detail: project.detail,
    stack: project.stack,
    install: project.install,
    version: project.version,
    link: project.link,
    next: project.next,
    connectsTo: project.connectsTo,
  };
}

export function LoadTheBar() {
  const f = flight("load-the-bar");
  const t = ui.loadTheBar;
  const plates = projects.map(toPlate);
  const data: LtbData = {
    plates,
    pegs: projectsByBus().map(({ bus, projects: list }) => ({
      bus: bus.id,
      name: bus.name,
      color: bus.color,
      ids: list.map((project) => project.id),
    })),
    sizes: projectStatuses.map((status) => ({ id: status.id, name: status.name, plain: status.plain })),
    shippedIds: projects.filter((project) => project.status === "shipped").map((project) => project.id),
    copy: t,
  };
  return (
    <section id={f.id} className="flight wrap" aria-labelledby="h-load-the-bar">
      <ScoreRow
        n={f.n}
        name={f.name}
        plain={f.plain}
        count={`${counts.projects} ${ui.counts.plates}`}
        headingId="h-load-the-bar"
      />
      <div className="no-print mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="prose-line">{t.intro}</p>
        <a href="#register" className="btn" data-skip-game>
          {t.skip}
        </a>
      </div>

      <LoadTheBarShell data={data}>
        <LoadTheBarView {...data} />
      </LoadTheBarShell>

      <div id="register" className="mt-10 scroll-mt-20">
        <ScoreRow
          sub
          name={ui.register.title}
          plain={ui.register.plain}
          count={`${counts.projects} ${ui.counts.plates}`}
          headingId="h-register"
        />
        <div className="panel mt-4">
          <Register
            rows={plates}
            buses={buses.map((bus) => ({ id: bus.id, name: bus.name }))}
            statuses={projectStatuses.map((status) => ({ id: status.id, name: status.name, plain: status.plain }))}
            copy={{ ...ui.register, connects: t.connects, install: t.install, version: t.version }}
          />
        </div>
      </div>
    </section>
  );
}
