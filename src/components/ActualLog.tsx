import { offPlatform, ui } from "@/content";
import { GYM_UI, REST_DAY_COUNT, TRAINING_DAY_COUNT } from "@/gym";
import { flight } from "@/lib/derive";
import { ScoreRow } from "./ScoreRow";
import { WeekFull } from "./WeekStrip";

export function ActualLog() {
  const f = flight("actual-log");
  return (
    <section id={f.id} className="flight wrap" aria-labelledby="h-actual-log">
      <ScoreRow
        n={f.n}
        name={f.name}
        plain={f.plain}
        count={`${TRAINING_DAY_COUNT} ${GYM_UI.trainingDays} · ${REST_DAY_COUNT} ${GYM_UI.restDays}`}
        headingId="h-actual-log"
      />
      <p className="prose-line mt-6">{ui.actualLog.intro}</p>
      <div className="mt-4">
        <WeekFull />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <a href="/gym/" className="btn btn-solid">
          {GYM_UI.openLog} <span className="plain">{GYM_UI.openLogPlain}</span>
        </a>
        {offPlatform ? (
          <p>
            <span className="label steel">{ui.actualLog.offPlatform}</span> {offPlatform}
          </p>
        ) : null}
      </div>
    </section>
  );
}
