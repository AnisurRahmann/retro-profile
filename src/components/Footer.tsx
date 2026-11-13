import { ui } from "@/content";
import { GYM_UI } from "@/gym";

export function Footer({ now, keys = true }: { now: Date; keys?: boolean }) {
  const t = ui.footer;
  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone: GYM_UI.timeZone,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(now);
  return (
    <footer className="border-t-2 border-iron">
      <div className="wrap label steel flex flex-wrap justify-between gap-x-8 gap-y-2 py-5">
        <p>
          {t.logged} {t.lastEntry} <time dateTime={now.toISOString().slice(0, 10)}>{date}</time>.
        </p>
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          <a href="/gym/">{ui.topbar.gym}</a>
          <a href="/notes/">
            {ui.notes.link} <span className="plain">{ui.notes.linkPlain}</span>
          </a>
        </p>
        {keys ? (
          <p className="js-only no-print w-full">
            {t.keys}: {t.keyFlights} · {t.keyLights} · {t.keyGym}
          </p>
        ) : null}
      </div>
    </footer>
  );
}
