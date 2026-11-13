import { dayHeadline, GYM_DAYS, GYM_UI } from "@/gym";

const gymHref = (id: string) => `/gym/#${id}`;

/** Compact seven-day strip: the server-rendered stand-in for the today chip. */
export function WeekMini() {
  return (
    <div className="week week-mini" role="list" aria-label={`${GYM_UI.weekLabel}, ${GYM_UI.weekPlain}`}>
      {GYM_DAYS.map((day) => (
        <a key={day.id} href={gymHref(day.id)} role="listitem" className="is-day" data-day={day.id}>
          <span className="label steel">{day.weekday.slice(0, 3)}</span>
          <span className="week-lift" data-rest={day.rest ? "" : undefined}>
            {day.lift}
          </span>
        </a>
      ))}
    </div>
  );
}

/** One chip per weekday. CSS shows the one matching <html data-today>, set from Asia/Dhaka time. */
export function TodayChips() {
  return (
    <div className="today-chips">
      {GYM_DAYS.map((day) => (
        <a key={day.id} href={gymHref(day.id)} className="chip" data-day={day.id} data-today-chip>
          <span>{GYM_UI.today}</span>
          <span>{day.weekday}</span>
          <span>{dayHeadline(day)}</span>
          {day.duration ? <span>{day.duration}</span> : null}
        </a>
      ))}
    </div>
  );
}

/** Full strip for Flight 07: day, lift, duration, today highlighted. */
export function WeekFull() {
  return (
    <ol className="grid grid-cols-2 border-2 border-b-0 border-r-0 border-iron sm:grid-cols-4 lg:grid-cols-7">
      {GYM_DAYS.map((day) => (
        <li key={day.id} className="border-b-2 border-r-2 border-iron">
          <a
            href={gymHref(day.id)}
            className="is-day flex h-full min-h-32 flex-col gap-1 p-3 no-underline hover:bg-chalk-2"
            data-day={day.id}
          >
            <span className="label flex justify-between gap-2">
              <span>{day.weekday}</span>
              <span className="steel">{day.num ? `${GYM_UI.day} ${day.num}` : GYM_UI.restDay}</span>
            </span>
            <span className="display mt-auto text-4xl" data-rest={day.rest ? "" : undefined}>
              {day.lift}
            </span>
            <span className="label steel">
              {day.emphasis ? `${day.emphasis} ` : ""}
              {day.duration ?? ""}
              <span className="today-flag">
                {day.duration ? " · " : ""}
                {GYM_UI.today}
              </span>
            </span>
          </a>
        </li>
      ))}
    </ol>
  );
}
