import { blocks, ui } from "@/content";
import { chartModel, counts, flight } from "@/lib/derive";
import { ScoreRow } from "./ScoreRow";

export function TrainingBlocks({ now }: { now: Date }) {
  const f = flight("training-blocks");
  const t = ui.blocks;
  const chart = chartModel(now);
  return (
    <section id={f.id} className="flight wrap" aria-labelledby="h-training-blocks">
      <ScoreRow
        n={f.n}
        name={f.name}
        plain={f.plain}
        count={`${counts.blocks} ${ui.counts.blocks}`}
        headingId="h-training-blocks"
      />

      {/* periodization chart: desktop only, the list below carries the same content */}
      <div className="chart panel mt-6 p-4" role="img" aria-label={t.chartAria}>
        <div />
        <div className="chart-track" style={{ height: "1.5rem" }}>
          {chart.years.map((tick) => (
            <span key={tick.year} className="chart-tick label steel pl-1" style={{ left: `${tick.left}%` }}>
              {tick.year}
            </span>
          ))}
        </div>
        {chart.rows.map((row) => (
          <div key={row.block.id} className="contents">
            <div className="flex items-center gap-2 border-b border-knurl pr-3">
              <span className="label steel">
                {t.block} {row.block.n}
              </span>
              <span className="display text-xl">{row.block.employer}</span>
            </div>
            <div className="chart-track">
              {chart.years.map((tick) => (
                <span key={tick.year} className="chart-tick" style={{ left: `${tick.left}%` }} />
              ))}
              <div
                className="chart-bar"
                data-open={row.open ? "" : undefined}
                style={{ left: `${row.left}%`, width: `${row.width}%` }}
              >
                {row.open ? (
                  <span className="label">
                    {t.now} <span className="plain">{t.currentPlain}</span>
                  </span>
                ) : (
                  <span className="chart-bar-note label steel" data-side={row.left > 60 ? "left" : undefined}>
                    {row.block.period}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <ol className="mt-6 border-2 border-iron">
        {blocks.map((block) => (
          <li key={block.id} className="border-b-2 border-iron last:border-b-0">
            <details className="tblock" open={!block.end} data-print-open>
              <summary className="flex items-start gap-3 p-3 hover:bg-chalk-2 md:items-center md:p-4">
                <span className="toggle" aria-hidden="true" />
                <span className="grid flex-1 gap-x-6 gap-y-1 md:grid-cols-[7rem_minmax(0,1fr)_auto] md:items-baseline">
                  <span className="label">
                    <b>
                      {t.block} {block.n}
                    </b>
                    {!block.end ? <span className="plain">{t.currentPlain}</span> : null}
                  </span>
                  <span>
                    <span className="display text-3xl md:text-4xl">{block.employer}</span>
                    {block.note ? <span className="label steel ml-2">{block.note}</span> : null}
                    <span className="mt-1 block font-semibold">{block.role}</span>
                  </span>
                  <span className="label steel">{block.period}</span>
                </span>
              </summary>
              <div className="grid gap-x-6 gap-y-2 border-t border-knurl p-3 md:grid-cols-[1.75rem_7rem_minmax(0,1fr)] md:p-4">
                <span className="hidden md:block" />
                <p className="label steel">
                  {t.trained} <span className="plain">{t.trainedPlain}</span>
                </p>
                <div>
                  <p className="prose-line">{block.summary}</p>
                  <ul className="mono mt-2 grid gap-1">
                    {block.trained.map((line) => (
                      <li key={line} className="flex gap-2">
                        <span aria-hidden="true" className="steel">
                          ×
                        </span>
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </details>
          </li>
        ))}
      </ol>
    </section>
  );
}
