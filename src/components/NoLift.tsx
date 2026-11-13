import { missPattern, misses, statusById, ui } from "@/content";
import { counts, flight } from "@/lib/derive";
import { Lights } from "./Lights";
import { ScoreRow } from "./ScoreRow";

export function NoLift() {
  const f = flight("no-lift");
  const t = ui.noLift;
  const failed = statusById("failed");
  return (
    <section id={f.id} className="flight wrap" aria-labelledby="h-no-lift">
      <ScoreRow n={f.n} name={f.name} plain={f.plain} count={`${counts.misses} ${ui.counts.misses}`} headingId="h-no-lift" />
      <p className="prose-line mt-6">{t.intro}</p>
      <ul className="mt-4 grid gap-4 lg:grid-cols-3">
        {misses.map((miss) => (
          <li key={miss.name} className="panel p-4" data-miss>
            <Lights status={failed} reveal />
            <h3 className="display mt-3 text-3xl">{miss.name}</h3>
            <p className="label steel mt-3">{t.happened}</p>
            <p>{miss.happened}</p>
            <p className="label steel mt-3">{t.adjustment}</p>
            <p>{miss.adjustment}</p>
          </li>
        ))}
      </ul>
      <p className="prose-line mt-4 border-l-[6px] border-iron pl-4">
        <span className="label steel block">{t.pattern}</span>
        {missPattern}
      </p>
    </section>
  );
}
