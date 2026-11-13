import { metrics, statusById, ui } from "@/content";
import { counts, flight } from "@/lib/derive";
import { Lights } from "./Lights";
import { ScoreRow } from "./ScoreRow";

export function PrBoard() {
  const f = flight("pr-board");
  const shipped = statusById("shipped");
  const t = ui.prBoard;
  return (
    <section id={f.id} className="flight wrap" aria-labelledby="h-pr-board">
      <ScoreRow n={f.n} name={f.name} plain={f.plain} count={`${counts.metrics} ${ui.counts.prs}`} headingId="h-pr-board" />
      <ol className="mt-6 grid gap-4 md:grid-cols-2">
        {metrics.map((metric, index) => (
          <li key={metric.id} id={metric.id} className="panel flex flex-col p-4 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="label">
                <b>
                  {t.pr} {String(index + 1).padStart(2, "0")}
                </b>
              </span>
              <Lights status={shipped} reveal />
            </div>
            <h3 className="display mt-4 text-3xl md:text-4xl">{metric.lift}</h3>
            <dl className="mt-3 flex flex-1 flex-col">
              {metric.previous ? (
                <div className="flex items-baseline gap-3">
                  <dt className="label steel">{t.previous}</dt>
                  <dd className="display pr-prev steel">{metric.previous}</dd>
                </div>
              ) : null}
              <div className="mt-auto pt-5">
                <dt className="label steel">
                  {metric.previous ? t.next : t.pr}
                  {metric.unit ? <span className="plain">{metric.unit}</span> : null}
                </dt>
                <dd className="display pr-value mt-3" data-countup="">
                  {metric.value}
                </dd>
              </div>
            </dl>
            {metric.delta ? <p className="label mt-3 border-t-2 border-iron pt-2">{metric.delta}</p> : null}
            <p className={`prose-line mt-3 ${metric.delta ? "" : "border-t-2 border-iron pt-3"}`}>{metric.how}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
