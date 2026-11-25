import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { caseStudies, fill, ui } from "@/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return caseStudies.map((c) => ({ slug: c.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const study = caseStudies.find((c) => c.slug === slug);
  if (!study) return {};
  return {
    title: study.title,
    description: study.problem,
    alternates: { canonical: `/work/${study.slug}` },
    openGraph: { title: study.title, description: study.problem, url: `/work/${study.slug}` },
  };
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 w-fit text-base font-medium text-text" data-on-sky="h2">
      {children}
    </h2>
  );
}

export default async function CaseStudyPage({ params }: Props) {
  const { slug } = await params;
  const study = caseStudies.find((c) => c.slug === slug);
  if (!study) notFound();

  const meta = [study.org, study.period, study.role].filter(Boolean).join(" · ");
  const ask = `/chat?q=${encodeURIComponent(fill(ui.work.askQuery, { title: study.title }))}`;

  return (
    <article>
      <div className="section">
        <Link
          href="/#shipped"
          className="font-mono text-xs text-graphite transition-colors duration-150 hover:text-text"
          data-on-sky="back"
        >
          {ui.work.back}
        </Link>
        <h1 className="mt-6 w-fit text-[28px] leading-9 font-medium tracking-[-0.01em] text-text" data-on-sky="h1">
          {study.title}
        </h1>
        <p className="mt-2 w-fit font-mono text-xs text-graphite" data-on-sky="meta">
          {meta}
        </p>
      </div>

      <section className="section">
        <Heading>{ui.work.problem}</Heading>
        <p className="w-fit max-w-[62ch] text-graphite" data-on-sky="body">
          {study.problem}
        </p>
      </section>

      <section className="section">
        <Heading>{ui.work.built}</Heading>
        <p className="w-fit max-w-[62ch] text-graphite" data-on-sky="body">
          {study.built}
        </p>
      </section>

      <section className="section">
        <Heading>{ui.work.flow}</Heading>
        <ol className="flex flex-col items-start sm:flex-row sm:flex-wrap sm:items-center sm:gap-y-1.5">
          {study.flow.map((step, i) => (
            <li key={step} className="flex flex-col items-start sm:flex-row sm:items-center">
              {i > 0 ? (
                <span aria-hidden="true" className="px-3 font-mono text-xs leading-5 text-graphite sm:px-1.5" data-on-sky="arrow">
                  <span className="sm:hidden">↓</span>
                  <span className="hidden sm:inline">→</span>
                </span>
              ) : null}
              <span className="rounded-md glass border border-hairline px-2.5 py-1 font-mono text-xs text-text">
                {step}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="section">
        <Heading>{ui.work.result}</Heading>
        <ul className="divide-y divide-hairline border-y border-hairline" data-on-sky="results">
          {study.results.map((r) => (
            <li key={r.label} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3">
              <span className="text-sm text-graphite">{r.label}</span>
              <span className="font-mono text-sm">
                {r.before ? (
                  <>
                    <span className="text-graphite">{r.before}</span>
                    <span aria-hidden="true" className="px-2 text-graphite">
                      →
                    </span>
                    <span className="sr-only"> to </span>
                  </>
                ) : null}
                <span className="text-text">{r.after}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="section">
        <Heading>{ui.work.stack}</Heading>
        <ul className="flex flex-wrap gap-1.5">
          {study.stack.map((s) => (
            <li key={s} className="glass rounded-md px-2 py-1 font-mono text-xs text-graphite">
              {s}
            </li>
          ))}
        </ul>
      </section>

      <p className="section">
        <Link href={ask} className="text-text underline decoration-hairline underline-offset-4 hover:decoration-text" data-on-sky="ask">
          {ui.work.askLine}
        </Link>
      </p>
    </article>
  );
}
