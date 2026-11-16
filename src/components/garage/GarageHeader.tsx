import { metrics, profile, ui } from "@/content";

/** Text first: name, role, the six metrics, the call button and the email link. Complete without JS or images. */
export function GarageHeader() {
  const h = ui.hero;
  return (
    <header className="wrap garage-header">
      <a href="#section-list" className="btn sr-only-focusable">
        {ui.skipToContent}
      </a>
      <h1 className="display garage-name">{profile.name}</h1>
      <p className="prose-line garage-role">{profile.line}</p>
      <ul className="garage-metrics" aria-label={`${h.prListLabel}, ${h.prListPlain}`}>
        {metrics.map((metric) => (
          <li key={metric.id}>
            <span className="display">{metric.value}</span>
            <span className="label">{metric.short}</span>
          </li>
        ))}
      </ul>
      <p className="garage-actions">
        <a href={profile.links.calendar.href} className="btn btn-solid">
          {ui.contact.book}
        </a>
        <a href={profile.links.email.href} className="label garage-email">
          <span className="sr-only">{ui.garage.email}: </span>
          {profile.links.email.label}
        </a>
      </p>
    </header>
  );
}
