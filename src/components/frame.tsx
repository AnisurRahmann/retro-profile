import { links, profile, sheets, ui } from "@/content";
import { sheetId } from "@/lib/derive";
import { RedlineSwitch, ThemeSwitch } from "./Toggles";

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const NUMBERS = ["1", "2", "3", "4", "5", "6", "7", "8"];

export function TopBar() {
  return (
    <header className="bar">
      <a
        className="monogram"
        href={`#${sheetId("00")}`}
        aria-label={`${profile.monogram}: ${profile.name}`}
      >
        {profile.monogram}
      </a>
      <nav className="bar-index" aria-label={ui.sheetIndex}>
        <ol>
          {sheets.map((s) => (
            <li key={s.no}>
              <a
                href={`#${sheetId(s.no)}`}
                data-sheet-link={s.no}
                aria-label={`${ui.sheet} ${s.no}: ${s.title}`}
              >
                {s.no}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <div className="bar-tools">
        <RedlineSwitch copy={ui.redlines} />
        <ThemeSwitch copy={ui.theme} />
        <a
          className="btn btn--bar btn--solid"
          href={links.calendar.href}
          target="_blank"
          rel="noreferrer"
        >
          {ui.bookCall}
        </a>
      </div>
    </header>
  );
}

/** The drawing sheet margin: zone numbers across, zone letters down. Decorative. */
export function Frame() {
  return (
    <div aria-hidden="true">
      <div className="frame frame--top">
        {NUMBERS.map((n) => (
          <span key={n}>{n}</span>
        ))}
      </div>
      <div className="frame frame--bottom">
        {NUMBERS.map((n) => (
          <span key={n}>{n}</span>
        ))}
      </div>
      <div className="frame frame--left">
        {LETTERS.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
      <div className="frame frame--right">
        {LETTERS.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
    </div>
  );
}
