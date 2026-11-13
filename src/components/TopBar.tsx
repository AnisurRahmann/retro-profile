import { flights, profile, ui } from "@/content";

/** Fixed top bar. `base` is "" on the home page and "/" on sub pages so flight links still resolve. */
export function TopBar({ base = "" }: { base?: string }) {
  const t = ui.topbar;
  return (
    <header className="topbar">
      <a href="#main" className="btn sr-only-focusable" style={{ position: "absolute", zIndex: 60 }}>
        {ui.skipToContent}
      </a>
      <div className="topbar-inner">
        <a href={base || "#platform"} className="topbar-cell topbar-mono" aria-label={`${profile.name}, ${t.home}`}>
          {profile.monogram}
        </a>
        <nav className="topbar-nav" aria-label={t.navLabel}>
          {flights.map((flight) => (
            <a key={flight.id} href={`${base}#${flight.id}`} className="topbar-cell">
              <span>{flight.n}</span>
              {flight.nav}
            </a>
          ))}
        </nav>
        <details className="topbar-menu" data-menu>
          <summary className="topbar-cell">{t.menu}</summary>
          <nav className="topbar-menu-list" aria-label={t.navLabel}>
            {flights.map((flight) => (
              <a key={flight.id} href={`${base}#${flight.id}`}>
                <span className="steel">{flight.n}</span>
                <span>
                  {flight.name} <span className="plain">{flight.plain}</span>
                </span>
              </a>
            ))}
          </nav>
        </details>
        <span className="topbar-spacer" />
        <button type="button" className="topbar-cell lights-toggle" data-lights-toggle aria-label={t.lightsAria}>
          <span className="when-light">
            {t.lightsOn} <span className="plain wide-only">{t.lightsOnPlain}</span>
          </span>
          <span className="when-dark">
            {t.lightsOut} <span className="plain wide-only">{t.lightsOutPlain}</span>
          </span>
        </button>
        <a href={profile.links.calendar.href} className="topbar-cell topbar-cta">
          <span className="wide-only">{t.cta}&nbsp;·&nbsp;</span>
          {t.ctaPlain}
        </a>
      </div>
    </header>
  );
}
