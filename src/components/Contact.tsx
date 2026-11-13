import { profile, ui } from "@/content";
import { flight } from "@/lib/derive";
import { ScoreRow } from "./ScoreRow";

export function Contact({ hasResume }: { hasResume: boolean }) {
  const f = flight("spot-me");
  const t = ui.contact;
  const rows = [
    { label: t.rows.email, link: profile.links.email },
    { label: t.rows.calendar, link: profile.links.calendar },
    { label: t.rows.github, link: profile.links.github },
    { label: t.rows.linkedin, link: profile.links.linkedin },
  ];
  return (
    <section id={f.id} className="flight wrap" aria-labelledby="h-spot-me">
      <ScoreRow n={f.n} name={f.name} plain={f.plain} count={`${rows.length} ${ui.counts.lines}`} headingId="h-spot-me" />
      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-stretch">
        <ul className="border-2 border-iron">
          {rows.map((row, index) => (
            <li key={row.label} className="border-b-2 border-iron last:border-b-0">
              <a
                href={row.link.href}
                className="grid grid-cols-[2.5rem_1fr] items-baseline gap-x-3 p-3 no-underline hover:bg-iron hover:text-chalk md:grid-cols-[3rem_8rem_1fr] md:p-4"
                data-contact
              >
                <span className="label">{String(index + 1).padStart(2, "0")}</span>
                <span className="label">{row.label}</span>
                <span className="display col-start-2 break-all text-2xl md:col-start-3 md:text-4xl">{row.link.label}</span>
              </a>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-3">
          <a href={profile.links.calendar.href} className="btn btn-solid btn-big flex-1">
            {t.book}
          </a>
          {hasResume ? (
            <a href="/resume.pdf" className="btn" download>
              {t.resume} <span className="plain">{t.resumePlain}</span>
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
