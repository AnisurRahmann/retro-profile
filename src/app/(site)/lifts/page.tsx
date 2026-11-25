import type { Metadata } from "next";
import { liftHref, lifts, ui } from "@/site";

export const metadata: Metadata = {
  title: ui.lifts.heading,
  description: ui.meta.liftsDescription,
  alternates: { canonical: "/lifts" },
};

export default function LiftsPage() {
  return (
    <>
      <div className="section">
        <h1 className="text-[36px] leading-10 font-medium tracking-[-0.02em] text-text">{ui.lifts.heading}</h1>
        <p className="mt-3 max-w-[62ch] text-graphite">{lifts.intro}</p>
        {lifts.routines.length === 0 && liftHref ? (
          <a href={liftHref} target="_blank" rel="noopener" className="mt-3 inline-block text-text underline underline-offset-4">
            {ui.lifts.liftLink}
          </a>
        ) : null}
      </div>

      {lifts.routines.map((day) => (
        <section key={day.id} id={day.id} aria-labelledby={`${day.id}-h`} className="section scroll-mt-6">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 id={`${day.id}-h`} className="text-base font-medium text-text">
              {day.weekday} <span className="text-graphite">· {day.title}</span>
            </h2>
            {day.duration ? <span className="font-mono text-xs text-graphite">{day.duration}</span> : null}
          </div>
          {day.rest ? (
            <p className="border-y border-hairline py-3 text-sm text-graphite">{day.restLine}</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead className="sr-only">
                <tr>
                  <th scope="col">{ui.lifts.exercise}</th>
                  <th scope="col">{ui.lifts.sets}</th>
                </tr>
              </thead>
              <tbody>
                {day.exercises.map((ex) => (
                  <tr key={ex.name} className="border-t border-hairline last:border-b">
                    <td className="py-2.5 pr-4 align-top">
                      <span className="text-text">{ex.name}</span>
                      {ex.note ? <span className="block text-xs leading-5 text-graphite">{ex.note}</span> : null}
                    </td>
                    <td className="py-2.5 text-right align-top font-mono whitespace-nowrap text-graphite">
                      {ex.prescription}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}

      {lifts.rules.length > 0 ? (
        <section className="section">
          <ul className="space-y-1 font-mono text-xs leading-5 text-graphite">
            {lifts.rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
