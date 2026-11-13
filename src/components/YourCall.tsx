import type { CSSProperties } from "react";
import { caseStudies, scenarios, statusById, ui } from "@/content";
import { counts } from "@/lib/derive";
import { Lights } from "./Lights";
import { ScoreRow } from "./ScoreRow";

/**
 * Game 2. Native radios plus CSS :has(): picking an option reveals the outcome.
 * No JS: every outcome is visible as a normal case study. No score, no timer.
 */
export function YourCall() {
  const t = ui.yourCall;
  const shipped = statusById("shipped");
  return (
    <div id="your-call" className="mt-12" aria-labelledby="h-your-call">
      <ScoreRow
        sub
        name={t.name}
        plain={t.plain}
        count={`${counts.scenarios} ${ui.counts.scenarios}`}
        headingId="h-your-call"
      />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="prose-line">{t.intro}</p>
        <label className="btn yc-all">
          <input type="checkbox" id="yc-all" className="sr-only" />
          <span>{t.skip}</span>
          <span className="plain">{t.skipPlain}</span>
        </label>
      </div>
      <p className="sr-only" role="status" aria-live="polite" data-yc-live data-message={t.announce} />

      <ol className="mt-6 grid gap-4">
        {scenarios.map((scenario, index) => {
          const study = caseStudies.find((entry) => entry.id === scenario.caseStudyId);
          if (!study) return null;
          const ordered = scenario.order.map((position) => scenario.options[position]).filter((o) => o !== undefined);
          const actual = scenario.options.find((option) => option.actual);
          const others = ordered.filter((option) => !option.actual);
          return (
            <li key={scenario.id} id={scenario.id} className="yc panel" data-yc>
              <div className="grid gap-x-8 gap-y-4 p-4 md:grid-cols-2 md:p-6">
                <div>
                  <p className="label steel">
                    {t.situation} {String(index + 1).padStart(2, "0")} · {study.title}
                  </p>
                  <p className="display mt-2 text-3xl md:text-4xl" style={{ lineHeight: 0.95 }}>
                    {scenario.situation}
                  </p>
                </div>
                <fieldset className="grid content-start gap-2">
                  <legend className="label steel mb-2">
                    {t.options} <span className="plain">{t.optionsPlain}</span>
                  </legend>
                  {ordered.map((option) => (
                    <label key={option.id} className="yc-option">
                      <input type="radio" name={scenario.id} value={option.id} />
                      <span>
                        {option.label}
                        {option.actual ? (
                          <span className="yc-tag label ml-2 border-2 border-current px-1.5 py-0.5 align-middle">
                            {t.actual}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  ))}
                </fieldset>
              </div>

              <div className="yc-outcome border-t-2 border-iron bg-chalk p-4 md:p-6">
                <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
                  <div>
                    <p className="label">
                      <b>{t.did}</b>
                    </p>
                    <p className="prose-line mt-2 font-semibold">{actual?.label}</p>
                    <p className="prose-line steel mt-2">{study.approach}</p>
                    <p className="label steel mt-4">
                      {t.flow} <span className="plain">{t.flowPlain}</span>
                    </p>
                    <ol className="flow mt-2">
                      {study.flow.map((step, stepIndex) => (
                        <li key={step} style={{ "--i": stepIndex } as CSSProperties}>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="label">
                        <b>{t.result}</b>
                      </p>
                      <Lights status={shipped} />
                    </div>
                    <p className="display mt-2 text-3xl md:text-4xl" style={{ lineHeight: 0.95 }}>
                      {scenario.result}
                    </p>
                    <p className="steel mt-2">{study.result}</p>
                    <dl className="mt-4 grid gap-2 border-t border-knurl pt-3">
                      {others.map((option) => (
                        <div key={option.id}>
                          <dt className="label steel">
                            {t.tradeOff} · {option.label}
                          </dt>
                          <dd>{option.tradeOff}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
