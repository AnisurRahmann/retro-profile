import type { CaseStudy, Experience, Metric, RoutingTier } from "@/content.schema";
import { ui } from "@/content";
import { period } from "@/lib/derive";
import { wrapLabel } from "@/lib/mapLayout";
import { BLOCK_CENTERS, staticTickPath, staticTracePath } from "@/lib/trace";
import { CountUp } from "./CountUp";
import { HeroTraceLive } from "./islands";

/** Visual A. Static SVG trace (the fallback) with the animated canvas mounted over it. */
export function HeroTrace() {
  const t = ui.trace;
  return (
    <div className="trace" role="img" aria-label={t.alt} data-trace="">
      <svg
        className="trace-static"
        viewBox="0 0 1200 200"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M0 100H1200" style={{ stroke: "var(--rule)", strokeWidth: 1 }} />
        <path d={staticTracePath(1200, 200)} />
        <path d={staticTickPath(1200, 200)} />
      </svg>
      <HeroTraceLive />
      <span className="trace-tag trace-tag--in" aria-hidden="true">
        {t.input}
      </span>
      {t.blocks.map((label, i) => (
        <div
          key={label}
          className="trace-block"
          aria-hidden="true"
          data-last={i === t.blocks.length - 1 ? "1" : undefined}
          style={{ left: `${(BLOCK_CENTERS[i] ?? 0) * 100}%` }}
        >
          <small>0{i + 1}</small>
          {label}
        </div>
      ))}
      <span className="trace-tag trace-tag--pass" aria-hidden="true">
        {t.pass}
      </span>
    </div>
  );
}

/** Visual D. A metric drawn as an engineering dimension. */
export function Dimension({ metric }: { metric: Metric }) {
  const c = ui.impact;
  return (
    <article className="dim">
      <h3 className="label label--ink">
        {metric.id} · {metric.label}
      </h3>
      <p className="dim-delta">
        <CountUp count={metric.delta} />
      </p>
      <p className="label dim-unit">{metric.deltaUnit}</p>
      <svg className="dim-line" aria-hidden="true" focusable="false">
        <line x1="0" y1="0" x2="0" y2="100%" />
        <line x1="100%" y1="0" x2="100%" y2="100%" />
        <line className="dim-main" x1="0" y1="14" x2="100%" y2="14" pathLength={1} />
        <path d="M0 14L12 10.5V17.5Z" />
        <svg x="100%" overflow="visible">
          <path d="M0 14L-12 10.5V17.5Z" />
        </svg>
      </svg>
      <dl className="dim-ends">
        <div>
          <dt className="label">{c.before}</dt>
          <dd>{metric.before}</dd>
        </div>
        <div>
          <dt className="label">{c.after}</dt>
          <dd>{metric.after}</dd>
        </div>
      </dl>
      <p className="dim-system">{metric.system}</p>
      {metric.derived && <p className="label dim-note">{c.derived}</p>}
    </article>
  );
}

/** Visual E. Work history as a drawing revision table. Rows are native <details>. */
export function RevisionTable({ rows }: { rows: Experience[] }) {
  const c = ui.work;
  return (
    <div className="rev-table" role="group" aria-label={c.tableCaption}>
      <div className="rev-row rev-head" aria-hidden="true">
        <span>{c.cols.rev}</span>
        <span>{c.cols.period}</span>
        <span>{c.cols.org}</span>
        <span>{c.cols.role}</span>
        <span>{c.cols.change}</span>
      </div>
      {rows.map((e, i) => (
        <details key={e.rev} open={i === 0}>
          <summary className="rev-row">
            <span className="rev-letter">
              <span className="sr-only">{c.cols.rev} </span>
              {e.rev}
            </span>
            <span className="rev-period">{period(e.from, e.to, ui.from, ui.openTo)}</span>
            <span className="rev-org">{e.org}</span>
            <span className="rev-role">{e.role}</span>
            <span className="rev-change">{e.change}</span>
          </summary>
          <ul className="rev-bullets">
            {e.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}

function arrowRight(x: number, y: number) {
  return `M${x} ${y}L${x - 7} ${y - 3.5}V${y + 3.5}Z`;
}
function arrowDown(x: number, y: number) {
  return `M${x} ${y}L${x - 3.5} ${y - 7}H${x + 3.5}Z`;
}

/** Block diagram generated from caseStudy.flow. Horizontal on wide screens, vertical on narrow ones. */
export function FlowDiagram({ study }: { study: CaseStudy }) {
  const flow = study.flow;
  const n = flow.length;
  const W = 540;
  const gap = 22;
  const bw = (W - (n - 1) * gap) / n;
  const bh = 52;
  const chars = Math.max(8, Math.floor(bw / 6.9));
  const VW = 280;
  const vh = 30;
  const vgap = 18;
  const label = `${ui.work.flowAlt}: ${flow.join(" → ")}`;
  return (
    <>
      <svg className="flow flow--h" viewBox={`0 0 ${W} ${bh + 2}`} role="img" aria-label={label}>
        {flow.map((step, i) => {
          const x = i * (bw + gap);
          const lines = wrapLabel(step, chars, 3);
          const y0 = 1 + bh / 2 - ((lines.length - 1) * 11.5) / 2 + 3.5;
          return (
            <g key={step}>
              {i > 0 && (
                <>
                  <line x1={x - gap} y1={1 + bh / 2} x2={x - 6} y2={1 + bh / 2} />
                  <path d={arrowRight(x - 1, 1 + bh / 2)} />
                </>
              )}
              <rect
                className={i === n - 1 ? "flow-last" : undefined}
                x={x + 1}
                y={1}
                width={bw - 2}
                height={bh}
              />
              {lines.map((line, k) => (
                <text key={k} x={x + bw / 2} y={y0 + k * 11.5}>
                  {line}
                </text>
              ))}
            </g>
          );
        })}
      </svg>
      <svg
        className="flow flow--v"
        viewBox={`0 0 ${VW} ${n * vh + (n - 1) * vgap + 2}`}
        role="img"
        aria-label={label}
      >
        {flow.map((step, i) => {
          const y = 1 + i * (vh + vgap);
          return (
            <g key={step}>
              {i > 0 && (
                <>
                  <line x1={VW / 2} y1={y - vgap} x2={VW / 2} y2={y - 6} />
                  <path d={arrowDown(VW / 2, y - 1)} />
                </>
              )}
              <rect
                className={i === n - 1 ? "flow-last" : undefined}
                x={1}
                y={y}
                width={VW - 2}
                height={vh}
              />
              <text x={VW / 2} y={y + vh / 2 + 3.5}>
                {step}
              </text>
            </g>
          );
        })}
      </svg>
    </>
  );
}

/** FIG. 3. Deterministic check first, LLM judge only on ambiguous cases. */
export function VerifierDiagram() {
  const v = ui.build.verifier;
  return (
    <svg className="verifier" viewBox="0 0 400 268" role="img" aria-label={ui.build.verifierAlt}>
      {/* input */}
      <rect className="thin" x="40" y="2" width="150" height="30" />
      <text x="115" y="21" textAnchor="middle">
        {v.input}
      </text>
      <line x1="115" y1="32" x2="115" y2="62" />
      <path d={arrowDown(115, 68)} />

      {/* layer 1 */}
      <rect x="10" y="68" width="210" height="50" />
      <text className="soft" x="20" y="84">
        01
      </text>
      <text className="strong" x="115" y="98" textAnchor="middle">
        {v.layer1}
      </text>
      <polyline points="220,82 300,82" />
      <path d={arrowRight(306, 82)} />
      <rect className="thin" x="306" y="70" width="84" height="24" />
      <text x="348" y="86" textAnchor="middle">
        {v.pass}
      </text>
      <polyline points="220,106 300,106" />
      <path d={arrowRight(306, 106)} />
      <rect className="thin" x="306" y="100" width="84" height="24" />
      <text x="348" y="116" textAnchor="middle">
        {v.fail}
      </text>
      <text className="soft" x="262" y="77" textAnchor="middle">
        {v.clear}
      </text>

      {/* ambiguous only */}
      <line className="dash" x1="115" y1="118" x2="115" y2="176" />
      <path d={arrowDown(115, 182)} />
      <text className="soft" x="124" y="152">
        {v.ambiguous}
      </text>

      {/* layer 2 */}
      <rect className="soft" x="10" y="182" width="210" height="50" />
      <text className="soft" x="20" y="198">
        02
      </text>
      <text className="strong" x="115" y="212" textAnchor="middle">
        {v.layer2}
      </text>
      <polyline points="220,196 300,196" />
      <path d={arrowRight(306, 196)} />
      <rect className="thin" x="306" y="184" width="84" height="24" />
      <text x="348" y="200" textAnchor="middle">
        {v.pass}
      </text>
      <polyline points="220,220 300,220" />
      <path d={arrowRight(306, 220)} />
      <rect className="thin" x="306" y="214" width="84" height="24" />
      <text x="348" y="230" textAnchor="middle">
        {v.fail}
      </text>
    </svg>
  );
}

/** FIG. 4. Share of calls per model tier. */
export function RoutingBar({ tiers }: { tiers: RoutingTier[] }) {
  const classes = ["t1", "t2", "t3"];
  const segs = tiers.map((t, i) => ({
    x: tiers.slice(0, i).reduce((sum, prev) => sum + prev.share, 0),
    w: t.share,
    cls: classes[i] ?? "t1",
    tier: t,
  }));
  return (
    <>
      <svg className="routing-bar" role="img" aria-label={ui.build.routingAlt}>
        <svg x="1" y="1" width="100%" height="100%" overflow="visible">
          {segs.map((s) => (
            <g key={s.tier.tier}>
              <rect className={s.cls} x={`${s.x}%`} y="0" width={`${s.w}%`} height="36" />
              {s.cls === "t1" && (
                <rect className="hatch" x={`${s.x}%`} y="0" width={`${s.w}%`} height="36" />
              )}
            </g>
          ))}
        </svg>
      </svg>
      <ul className="routing-key">
        {segs.map((s) => (
          <li key={s.tier.tier}>
            <svg viewBox="0 0 18 14" aria-hidden="true" focusable="false">
              <rect className={s.cls} x="1" y="1" width="16" height="12" style={fill(s.cls)} />
              {s.cls === "t1" && (
                <rect
                  x="1"
                  y="1"
                  width="16"
                  height="12"
                  style={{ fill: "url(#ds-hatch)", stroke: "none" }}
                />
              )}
            </svg>
            <span>
              <strong className="mono">
                {s.tier.tier} · {s.tier.range}
              </strong>
              <br />
              <span className="muted">{s.tier.use}</span>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

function fill(cls: string): React.CSSProperties {
  if (cls === "t2") return { fill: "var(--paper-2)" };
  if (cls === "t3") return { fill: "var(--ink)" };
  return {};
}
