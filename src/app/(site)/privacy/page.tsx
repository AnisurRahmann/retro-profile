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
        </section>
      ))}
    </article>
  );
}
