import type { Metadata } from "next";
import { fill, links, ui } from "@/site";

export const metadata: Metadata = {
  title: ui.privacy.heading,
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <article>
      <h1 className="section text-[36px] leading-10 font-medium tracking-[-0.02em] text-text">{ui.privacy.heading}</h1>
      {ui.privacy.sections.map((s) => (
        <section key={s.heading} className="mt-10">
          <h2 className="mb-2 text-base font-medium text-text">{s.heading}</h2>
          <p className="max-w-[62ch] text-graphite">{fill(s.body, { email: links.email })}</p>
          {s.links?.length ? (
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {s.links.map((l) => (
                <a key={l.href} href={l.href} target="_blank" rel="noopener" className="text-text underline decoration-hairline underline-offset-4 hover:decoration-graphite">
                  {l.label}
                </a>
              ))}
            </p>
          ) : null}
        </section>
      ))}
    </article>
  );
}
