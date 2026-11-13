import { companies, goalBlocks, goals, offer, profile, ui } from "@/content";
import { counts, flight, goalCurrent } from "@/lib/derive";
import { ScoreRow } from "./ScoreRow";

export function NextBlock() {
  const f = flight("next-block");
  const t = ui.nextBlock;
  return (
    <section id={f.id} className="flight wrap" aria-labelledby="h-next-block">
      <ScoreRow n={f.n} name={f.name} plain={f.plain} count={`${counts.goals} ${ui.counts.lifts}`} headingId="h-next-block" />

      <p className="label mt-6">
        <b>{t.attempts}</b> <span className="plain">{t.attemptsPlain}</span>
      </p>
      <div className="mt-2 grid gap-4 lg:grid-cols-3">
        {companies.map((company) => (
          <article key={company.n} className="panel flex flex-col p-4">
            <p className="label steel">{company.n}</p>
            <h3 className="display mt-1 text-5xl">{company.name}</h3>
            <p className="mt-3 flex-1">{company.plan}</p>
            <p className="mt-4 border-t-2 border-iron pt-2">
              <span className="label steel block">{t.target}</span>
              <span className="display text-2xl">{company.target}</span>
            </p>
          </article>
        ))}
        <article className="flex flex-col border-2 border-iron bg-iron p-4 text-chalk">
          <p className="label">{offer.plain}</p>
          <h3 className="display mt-1 text-5xl">{offer.title}</h3>
          <p className="mt-3 font-semibold">{offer.pitch}</p>
          <dl className="mt-3 grid flex-1 content-start gap-2">
            {offer.terms.map((term) => (
              <div key={term.label} className="grid grid-cols-[5.5rem_1fr] gap-2 border-t border-chalk/40 pt-2">
                <dt className="label">{term.label}</dt>
                <dd>{term.value}</dd>
              </div>
            ))}
          </dl>
          <a href={profile.links.calendar.href} className="btn mt-4">
            {offer.cta}
          </a>
        </article>
      </div>

      <p className="label mt-8">
        <b>{t.program}</b> <span className="plain">{t.programPlain}</span>
      </p>
      <div className="panel mt-2">
        <table className="log log-stack">
          <thead>
            <tr>
              <th scope="col">
                {t.columns.lift} <span className="plain">{t.columns.liftPlain}</span>
              </th>
              <th scope="col">{t.columns.current}</th>
              <th scope="col">{t.columns.target}</th>
              <th scope="col">{t.columns.block}</th>
            </tr>
          </thead>
          <tbody>
            {goals.map((goal) => {
              const block = goalBlocks.find((entry) => entry.id === goal.block);
              return (
                <tr key={`${goal.block}-${goal.lift}`} data-goal>
                  <th scope="row" className="font-semibold" style={{ fontFamily: "inherit", fontSize: "inherit", letterSpacing: 0, textTransform: "none", borderBottomWidth: 1, borderColor: "var(--knurl)" }}>
                    {goal.lift}
                  </th>
                  <td className="mono steel" data-label={t.columns.current}>
                    {goalCurrent(goal)}
                  </td>
                  <td data-label={t.columns.target}>{goal.target}</td>
                  <td className="label whitespace-nowrap" data-label={t.columns.block}>
                    <b>{block?.name}</b> <span className="plain">{block?.plain}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
