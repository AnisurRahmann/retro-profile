import type { CSSProperties } from "react";
import { metrics, profile, ui } from "@/content";
import { GYM_UI } from "@/gym";
import { flight, sinceYear } from "@/lib/derive";
import { Barbell } from "./Barbell";
import { TodayChips, WeekMini } from "./WeekStrip";

export function Hero() {
  const f = flight("platform");
  const h = ui.hero;
  // plates alternate sides so the bar loads balanced: even index left, odd index right
  const plate = (index: number) => {
    const metric = metrics[index];
    if (!metric) return null;
    return (
      <a
        key={metric.id}
        href={`#${metric.id}`}
        className="eplate"
        data-slide=""
        data-p={index}
        style={{ "--i": index } as CSSProperties}
      >
        <span className="sr-only">
          {h.prLabel} {index + 1}: {metric.lift},{" "}
        </span>
        <span>{metric.plate}</span>
        <span className="sr-only"> {metric.short}</span>
      </a>
    );
  };
  return (
    <section id={f.id} className="hero" aria-labelledby="hero-name">
      <div className="wrap">
        <p className="label flex flex-wrap justify-between gap-x-4 gap-y-1 border-b-2 border-iron pb-2">
          <span>
            <b>
              {ui.flight} {f.n} · {f.name}
            </b>{" "}
            <span className="plain">{f.plain}</span>
          </span>
          <span className="steel">
            {ui.counts.since} {sinceYear()}
          </span>
        </p>
        <h1 id="hero-name" className="display hero-name mt-4">
          {profile.name.split(" ").map((part, index) => (
            <span key={part}>
              {index > 0 ? " " : ""}
              {part}
            </span>
          ))}
        </h1>
        <div className="mt-4 grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="tag">
              {h.aliasLabel} <b>{profile.alias}</b>
            </p>
            <p className="prose-line mt-3 text-xl font-semibold leading-snug md:text-2xl">{profile.line}</p>
            <p className="prose-line steel mt-2">{profile.summary}</p>
          </div>
          <div className="lg:max-w-sm">
            <p className="label steel mb-1.5">
              {GYM_UI.today} <span className="plain">{GYM_UI.todayPlain}</span>
            </p>
            <div className="hero-week">
              <WeekMini />
            </div>
            <TodayChips />
          </div>
        </div>
      </div>

      <div className="hero-bar-wrap mt-2">
        <Barbell
          className="hero-bar"
          label={h.barbellAria}
          left={[plate(0), plate(2), plate(4)]}
          right={[plate(1), plate(3), plate(5)]}
        />
        <div className="wrap">
          <div className="readout label steel" aria-hidden="true">
            <span data-r="hint">
              {h.prListLabel} <span className="plain">{h.prListPlain}</span>
            </span>
            {metrics.map((metric, index) => (
              <span key={metric.id} data-r={index}>
                <b>
                  {h.prLabel} {String(index + 1).padStart(2, "0")} · {metric.lift}
                </b>{" "}
                · {metric.previous ? `${metric.previous} → ` : ""}
                {metric.value} {metric.unit ?? ""}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="wrap pb-10">
        <ul className="pr-strip mt-2" aria-label={`${h.prListLabel}, ${h.prListPlain}`}>
          {metrics.map((metric) => (
            <li key={metric.id}>
              <a href={`#${metric.id}`}>
                <span className="display block">{metric.value}</span>
                <span className="label steel mt-1 block">{metric.short}</span>
              </a>
            </li>
          ))}
        </ul>

        <div className="hero-paths mt-5 grid gap-3 md:grid-cols-3">
          {h.paths.map((path) => (
            <a key={path.href} href={path.href} className="btn">
              <span>{path.label}</span>
              <span className="plain">{path.plain}</span>
            </a>
          ))}
        </div>

        <dl className="label steel mt-5 flex flex-wrap gap-x-8 gap-y-1">
          <div className="flex gap-2">
            <dt>{h.baseLabel}</dt>
            <dd>
              {profile.location}. {profile.hours}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt>{h.credentialsLabel}</dt>
            <dd>{profile.credentials.join(" · ")}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
