import type { Content, Goal } from "@/content.schema";
import { links, profile, ui } from "@/content";
import { BUILD_DATE } from "@/lib/build";
import { sheetId, statusCounts } from "@/lib/derive";
import { seedFrom, wobblyLine } from "@/lib/handdrawn";
import { SystemMapLazy } from "./islands";
import { Arrow, RedCircle, RedNote, Sheet, Swatch } from "./primitives";
import { ProjectRef } from "./ProjectRef";
import Register from "./Register";
import { RedlinesOnButton } from "./Toggles";
import {
  Dimension,
  FlowDiagram,
  HeroTrace,
  RevisionTable,
  RoutingBar,
  VerifierDiagram,
} from "./visuals";

type P = { content: Content };

function goalById(content: Content, no: string): Goal | undefined {
  const id = content.sheets.find((s) => s.no === no)?.redlineGoalId;
  return content.goals.items.find((g) => g.id === id);
}

export function Sheet00({ content }: P) {
  const goal = goalById(content, "00");
  const tb = ui.titleBlock;
  return (
    <Sheet
      no="00"
      first
      hideHead
      titleExtra={[
        { label: tb.location, value: profile.location },
        { label: tb.hours, value: profile.hours },
      ]}
    >
      <div className="cover-name">
        <h1 id={`${sheetId("00")}-h`} className="display display--hero">
          {profile.name}
        </h1>
        <p className="alias">
          <svg viewBox="0 0 56 22" aria-hidden="true" focusable="false">
            <circle cx="3" cy="19" r="2.5" />
            <path d="M3 19L20 4H56" />
          </svg>
          <span>{ui.cover.aliasLabel}</span>
          <strong>{profile.alias}</strong>
        </p>
      </div>
      <div className="cover-grid">
        <p className="lede">{profile.roleLine}</p>
        <div>
          <p className="summary">{profile.summary}</p>
          <ul className="creds label" aria-label={ui.cover.credentials}>
            {profile.credentials.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      </div>

      <figure className="figure">
        <HeroTrace />
        <figcaption className="label label--ink">{ui.trace.caption}</figcaption>
      </figure>
      {goal && (
        <div className="cover-redline">
          <RedNote seed="cover" point="up">
            <p>{goal.text}</p>
          </RedNote>
        </div>
      )}

      <ul className="lanes" aria-label={ui.cover.lanesLabel}>
        {ui.cover.lanes.map((lane) => (
          <li key={lane.to}>
            <a className="btn" href={`#${sheetId(lane.to)}`}>
              <span>
                {lane.label}
                <small>
                  {ui.sheet} {lane.to} · {lane.hint}
                </small>
              </span>
              <Arrow />
            </a>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

export function Sheet01({ content }: P) {
  const goal = goalById(content, "01");
  return (
    <Sheet
      no="01"
      headExtra={
        goal && (
          <RedNote seed="impact" point="left" className="sheet-redline">
            <p>{goal.text}</p>
          </RedNote>
        )
      }
    >
      <ul className="dims">
        {content.metrics.map((m) => (
          <li key={m.id}>
            <Dimension metric={m} />
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

export function Sheet02({ content }: P) {
  const c = ui.work;
  return (
    <Sheet no="02">
      <RevisionTable rows={content.experience} />
      <h3 className="label label--ink cases-head">{c.caseHeading}</h3>
      <ol className="cases">
        {content.caseStudies.map((cs) => (
          <li className="case" key={cs.id}>
            <header>
              <p className="label">
                {c.detail} {cs.id}
              </p>
              <h4 className="display display--sub">{cs.title}</h4>
            </header>
            <dl>
              <div>
                <dt className="label">{c.problem}</dt>
                <dd>{cs.problem}</dd>
              </div>
              <div>
                <dt className="label">{c.built}</dt>
                <dd>{cs.built}</dd>
              </div>
            </dl>
            <div>
              <p className="label" style={{ marginBottom: 8 }}>
                {c.flow}
              </p>
              <FlowDiagram study={cs} />
            </div>
            <dl className="case-result">
              <div>
                <dt className="label">{c.result}</dt>
                <dd>{cs.result}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ol>
    </Sheet>
  );
}

export function Sheet03({ content }: P) {
  const counts = statusCounts(content.projects);
  const goal = goalById(content, "03");
  const m = ui.map;
  return (
    <Sheet no="03">
      <div className="map-top">
        <ul className="counters" aria-label={m.counters} data-counters="">
          {content.statuses.map((s) => {
            const body = (
              <>
                <Swatch status={s.id} />
                <span className="label label--ink">{s.label}</span>
                <b data-count={s.id}>{counts[s.id]}</b>
              </>
            );
            return (
              <li key={s.id}>
                {s.id === "SPECD" && goal ? <RedCircleRow seed="specd">{body}</RedCircleRow> : body}
              </li>
            );
          })}
          <li>
            <span className="label">{m.total}</span>
            <b data-count="TOTAL">{content.projects.length}</b>
          </li>
        </ul>
        {goal && (
          <RedNote seed="map" point="up">
            <p>{goal.text}</p>
          </RedNote>
        )}
      </div>

      <figure className="figure" style={{ marginTop: 0 }}>
        <SystemMapLazy
          projects={content.projects}
          buses={content.buses}
          statuses={content.statuses}
          copy={ui.map}
        />
        <figcaption className="label label--ink">{m.caption}</figcaption>
      </figure>
      <p className="label map-hint">{m.hint}</p>

      <div className="legend">
        <p className="label label--ink">{m.legend}</p>
        <ul>
          {content.statuses.map((s) => (
            <li key={s.id}>
              <Swatch status={s.id} />
              <span>
                <strong>{s.meaning}</strong>
                <span className="label">{s.line}</span>
              </span>
            </li>
          ))}
          <li>
            <svg className="swatch" viewBox="0 0 44 20" aria-hidden="true" focusable="false">
              <polyline className="map-wire" points="2,4 2,15 42,15 42,4" />
              <rect className="map-dot" x="-0.5" y="1.5" width="5" height="5" />
              <rect className="map-dot" x="39.5" y="1.5" width="5" height="5" />
            </svg>
            <span>{m.legendWire}</span>
          </li>
          <li>
            <svg className="swatch" viewBox="0 0 44 20" aria-hidden="true" focusable="false">
              <line className="map-rail" x1="0" y1="5" x2="44" y2="5" />
              <line className="map-stub" x1="22" y1="5" x2="22" y2="20" />
              <circle className="map-dot" cx="22" cy="5" r="4" />
            </svg>
            <span>{m.legendJunction}</span>
          </li>
          <li className="redline">
            <svg className="swatch" viewBox="0 0 44 20" aria-hidden="true" focusable="false">
              <path className="rl-stroke" d={wobblyLine(2, 12, 42, 9, 11)} />
            </svg>
            <span>{m.legendRedline}</span>
          </li>
        </ul>
      </div>
    </Sheet>
  );
}

function RedCircleRow({ children, seed }: { children: React.ReactNode; seed: string }) {
  return (
    <RedCircle seed={seed}>
      <span style={{ display: "flex", alignItems: "center", gap: 10 }}>{children}</span>
    </RedCircle>
  );
}

export function Sheet04({ content }: P) {
  return (
    <Sheet no="04">
      <Register
        projects={content.projects}
        buses={content.buses}
        statuses={content.statuses}
        copy={ui.register}
      />
    </Sheet>
  );
}

export function Sheet05({ content }: P) {
  const goal = goalById(content, "05");
  const b = ui.build;
  return (
    <Sheet no="05">
      <div className="build-grid">
        <section aria-labelledby="notes-h">
          <h3 id="notes-h" className="label label--ink">
            {b.notes}
          </h3>
          <ol className="notes">
            {content.principles.map((p) => (
              <li key={p.n}>
                <div>
                  <h4>{p.title}</h4>
                  {p.body && <p>{p.body}</p>}
                </div>
              </li>
            ))}
          </ol>
        </section>
        <div className="figs">
          <figure className="figure">
            <div className="fig-box">
              <VerifierDiagram />
            </div>
            <figcaption className="label label--ink">{b.verifierCaption}</figcaption>
            {goal && (
              <RedNote seed="verifier" point="up" className="sheet-redline">
                <p>{goal.text}</p>
              </RedNote>
            )}
          </figure>
          <figure className="figure">
            <div className="fig-box">
              <RoutingBar tiers={content.routing} />
            </div>
            <figcaption className="label label--ink">{b.routingCaption}</figcaption>
          </figure>
          <section aria-labelledby="stack-h">
            <h3 id="stack-h" className="label label--ink">
              {b.stack}
            </h3>
            <ul className="stack-line">
              {content.stackLine.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </Sheet>
  );
}

function Checkbox({ seed }: { seed: string }) {
  const s = seedFrom(seed);
  const d = [
    wobblyLine(2, 3, 18, 2, s),
    wobblyLine(18, 2, 19, 18, s + 1),
    wobblyLine(19, 18, 3, 19, s + 2),
    wobblyLine(3, 19, 2, 3, s + 3),
  ].join("");
  return (
    <svg viewBox="0 0 21 21" role="img" aria-label={ui.goals.notDone}>
      <path className="rl-stroke draw" pathLength={1} d={d} />
    </svg>
  );
}

export function Sheet06({ content }: P) {
  const g = ui.goals;
  const { goals, projects } = content;
  const name = (id: string) => projects.find((p) => p.id === id)?.name ?? "";
  const specd = statusCounts(projects).SPECD;
  return (
    <Sheet no="06" red>
      <div className="redline-off-only off-notice">
        <p>{ui.redlines.offNotice}</p>
        <RedlinesOnButton label={ui.redlines.offAction} />
      </div>
      <div className="redline" data-goals="">
        <h3 className="label" style={{ marginBottom: 12 }}>
          {g.plan}
        </h3>
        <div className="companies">
          {goals.companies.map((co) => (
            <article className="company" key={co.id}>
              <p className="label">{co.id}</p>
              <h4 className="display">{co.name}</h4>
              <p>{co.body}</p>
              <p className="target">{co.target}</p>
              {co.projectIds.length > 0 && (
                <p className="refs">
                  <span className="label">{g.committed}</span>
                  {co.projectIds.map((id) => (
                    <ProjectRef key={id} id={id} name={name(id)} openLabel={ui.map.open} />
                  ))}
                </p>
              )}
            </article>
          ))}
        </div>

        <section className="spec" aria-labelledby="offer-h">
          <h3 id="offer-h">
            <span className="label">{g.offer}</span>
            <span>{goals.offer.title}</span>
          </h3>
          <dl>
            {goals.offer.rows.map((row) => (
              <div key={row.label}>
                <dt className="label">{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="horizons">
          {goals.horizons.map((h) => (
            <section className="horizon" key={h.id} aria-labelledby={`h-${h.id}`}>
              <header>
                <h3 id={`h-${h.id}`} className="display">
                  {h.label}
                </h3>
                <span className="label">{h.note}</span>
              </header>
              <ul>
                {goals.items
                  .filter((goal) => goal.horizon === h.id)
                  .map((goal) => (
                    <li className="goal" key={goal.id} data-goal={goal.id}>
                      <Checkbox seed={goal.id} />
                      <p>{goal.text}</p>
                      <div className="goal-meta">
                        <span>{goal.id}</span>
                        {goal.target && (
                          <span>
                            {g.target}: {goal.target}
                          </span>
                        )}
                        {goal.id === "G-16" && (
                          <span>
                            {g.specdNow}: {specd}, {g.specdTarget}
                          </span>
                        )}
                        {goal.projectIds.map((id) => (
                          <ProjectRef key={id} id={id} name={name(id)} openLabel={ui.map.open} />
                        ))}
                        {goal.attachesTo && (
                          <span>
                            {g.attaches}: {goal.attachesTo}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </Sheet>
  );
}

export function Sheet07({ content }: P) {
  const c = ui.contact;
  const rows = [links.email, links.calendar, links.github, links.linkedin];
  const offer = content.goals.offer;
  return (
    <Sheet no="07">
      <div className="contact-grid">
        <dl className="transmittal" aria-label={c.transmittal}>
          <div>
            <dt className="label">{c.to}</dt>
            <dd>{c.toValue}</dd>
          </div>
          <div>
            <dt className="label">{c.from}</dt>
            <dd>
              {profile.name} ({profile.alias})
              <small>
                {profile.title}. {profile.location}.
              </small>
              <small>{profile.credentials.join(". ")}.</small>
            </dd>
          </div>
          <div>
            <dt className="label">{c.re}</dt>
            <dd>{c.reValue}</dd>
          </div>
          {rows.map((link, i) => (
            <div key={link.label} className={i === 0 ? "tr-break" : undefined}>
              <dt className="label">{link.label}</dt>
              <dd>
                <a
                  href={link.href}
                  {...(link.href.startsWith("mailto:")
                    ? {}
                    : { target: "_blank", rel: "noreferrer me" })}
                >
                  {link.display}
                  {!link.href.startsWith("mailto:") && (
                    <span className="sr-only"> ({ui.external})</span>
                  )}
                </a>
              </dd>
            </div>
          ))}
        </dl>
        <div className="contact-cta">
          <a
            className="btn btn--solid btn--big"
            href={links.calendar.href}
            target="_blank"
            rel="noreferrer"
          >
            {ui.book30}
            <Arrow />
          </a>
          <RedNote seed="contact" point="up">
            <p>
              {offer.title}. {offer.rows[0]?.value}
            </p>
          </RedNote>
        </div>
      </div>
    </Sheet>
  );
}

export function Colophon() {
  const c = ui.contact;
  const k = ui.shortcuts;
  return (
    <footer className="colophon label">
      <p>
        {c.footer} {c.revised} <time dateTime={BUILD_DATE}>{BUILD_DATE}</time>.
      </p>
      <ul className="keys" aria-label={k.label}>
        {k.items.map((item) => (
          <li key={item.keys}>
            <kbd>{item.keys}</kbd>
            {item.action}
          </li>
        ))}
      </ul>
    </footer>
  );
}
