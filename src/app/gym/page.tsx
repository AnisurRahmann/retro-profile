import type { Metadata } from "next";
import { projectById, ui } from "@/content";
import { Footer } from "@/components/Footer";
import { Knurl, ScoreRow } from "@/components/ScoreRow";
import { TopBar } from "@/components/TopBar";
import { dayHeadline, GYM_DAYS, GYM_RULES, GYM_UI, REST_DAY_COUNT, TRAINING_DAY_COUNT } from "@/gym";

export const metadata: Metadata = {
  title: GYM_UI.metaTitle,
  description: GYM_UI.metaDescription,
  alternates: { canonical: "/gym/" },
  openGraph: { title: GYM_UI.metaTitle, description: GYM_UI.metaDescription, url: "/gym/", images: ["/og.png"] },
};

export default function GymPage() {
  const lift = projectById("P-13");
  return (
    <>
      <TopBar base="/" />
      <main id="main" className="pt-[var(--bar-h)]">
        <div className="backlink border-b-2 border-iron bg-chalk">
          <div className="wrap flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
            <a href="/" className="label font-semibold">
              ← {GYM_UI.back}
            </a>
            <nav aria-label={GYM_UI.jump} className="label flex flex-wrap gap-x-3 gap-y-1">
              {GYM_DAYS.map((day) => (
                <a key={day.id} href={`#${day.id}`} className="is-day px-1" data-day={day.id}>
                  {day.weekday.slice(0, 3)}
                </a>
              ))}
            </nav>
          </div>
        </div>

        <div className="wrap pb-16 pt-8">
          <h1 className="sr-only">
            {GYM_UI.pageTitle}: {GYM_UI.pagePlain}
          </h1>
          <ScoreRow
            sub
            name={GYM_UI.pageTitle}
            plain={GYM_UI.pagePlain}
            count={`${TRAINING_DAY_COUNT} ${GYM_UI.trainingDays} · ${REST_DAY_COUNT} ${GYM_UI.restDays}`}
            headingId="h-gym"
          />
          <p className="prose-line mt-4">{GYM_UI.intro}</p>
          {lift.link ? (
            <p className="mt-2">
              {GYM_UI.liftLine} <a href={lift.link.href}>{lift.link.label}</a>
            </p>
          ) : null}

          <div className="mt-8 grid gap-6">
            {GYM_DAYS.map((day) => (
              <article key={day.id} id={day.id} className="gym-day scroll-mt-28 border-2 border-iron" data-gym-day={day.id}>
                <header className="gym-head p-4 md:p-6">
                  {day.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- static export, decorative dimmed background
                    <img src={day.photo} alt="" width={788} height={1400} loading="lazy" decoding="async" />
                  ) : null}
                  <p className="label flex flex-wrap justify-between gap-2">
                    <span>
                      <b>{day.weekday}</b>
                      <span className="today-flag"> · {GYM_UI.today}</span>
                    </span>
                    <span className="steel">{day.num ? `${GYM_UI.day} ${day.num}` : GYM_UI.restDay}</span>
                  </p>
                  <div className={`flex flex-wrap items-end justify-between gap-x-6 gap-y-2 ${day.rest ? "mt-6" : "mt-16 md:mt-24"}`}>
                    <h2 className="display text-6xl md:text-8xl">
                      {day.num ? <span className="steel mr-3">{day.num}</span> : null}
                      {dayHeadline(day)}
                    </h2>
                    {day.duration ? <p className="display text-3xl md:text-4xl">{day.duration}</p> : null}
                  </div>
                  {day.rest && day.restLine ? <p className="mono mt-3">{day.restLine}</p> : null}
                </header>
                {day.exercises.length > 0 ? (
                  <div className="panel border-0 border-t-2">
                    <table className="log log-stack gym-table mono">
                      <thead>
                        <tr>
                          <th scope="col">{GYM_UI.columns.exercise}</th>
                          <th scope="col">{GYM_UI.columns.prescription}</th>
                          <th scope="col">{GYM_UI.columns.note}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {day.exercises.map((exercise) => (
                          <tr key={exercise.name}>
                            <td className="font-semibold">{exercise.name}</td>
                            <td className="whitespace-nowrap" data-label={GYM_UI.columns.prescription}>
                              {exercise.prescription}
                            </td>
                            <td className="steel" data-label={exercise.note ? GYM_UI.columns.note : undefined}>
                              {exercise.note}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </article>
            ))}
          </div>

          <section className="mt-10" aria-labelledby="h-gym-rules">
            <ScoreRow
              sub
              name={GYM_UI.rulesTitle}
              plain={GYM_UI.rulesPlain}
              count={`${GYM_RULES.length} ${ui.counts.rules}`}
              headingId="h-gym-rules"
            />
            <ol className="panel mt-4">
              {GYM_RULES.map((rule, index) => (
                <li key={rule} className="flex gap-4 border-b border-knurl p-4 last:border-b-0" data-gym-rule>
                  <span className="display steel w-8 flex-none text-3xl">{String(index + 1).padStart(2, "0")}</span>
                  <span className="font-semibold">{rule}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
        <Knurl />
      </main>
      <Footer now={new Date()} />
    </>
  );
}
