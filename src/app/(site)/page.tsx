import { CardSection } from "@/components/CardSection";
import { Closer } from "@/components/Closer";
import { Portrait } from "@/components/Portrait";
import { ReceiptCard } from "@/components/ReceiptCard";
import { StatusLine } from "@/components/StatusLine";
import { SkyLabel } from "@/components/sky/SkyLabel";
import { Waveform } from "@/components/Waveform";
import { building, links, profile, receipts, shipped, ui } from "@/site";

const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: profile.name,
  alternateName: profile.legalName,
  jobTitle: profile.title,
  description: profile.oneLiner,
  url: links.site,
  sameAs: [links.github, links.linkedin],
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd).replace(/</g, "\\u003c") }}
      />
      <section className="section flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
        <Portrait size={88} priority />
        <div className="min-w-0">
          <h1 className="text-[36px] leading-10 font-medium tracking-[-0.02em] text-text">
            {profile.name}
          </h1>
          <p className="mt-2 flex min-h-14 items-start gap-2.5 text-lg leading-7 text-graphite sm:min-h-7">
            <span className="flex h-7 items-center">
              <Waveform />
            </span>
            <StatusLine lines={profile.statusLines} />
          </p>
          <p className="mt-1 text-sm text-graphite">{profile.oneLiner}</p>
          <SkyLabel copy={ui.sky} />
        </div>
      </section>

      <CardSection id="shipped" heading={ui.home.shipped} items={shipped} />
      <CardSection id="bench" heading={ui.home.bench} items={building} />

      {receipts.length > 0 ? (
        <section aria-labelledby="receipts-heading" className="section">
          <h2 id="receipts-heading" className="mb-4 text-base font-medium text-text">
            {ui.home.receipts}
          </h2>
          <div className="masonry">
            {receipts.map((r) => (
              <ReceiptCard key={r.id} receipt={r} />
            ))}
          </div>
          <p className="mt-2 font-mono text-xs leading-5 text-graphite">{ui.home.receiptsNote}</p>
        </section>
      ) : null}

      <Closer />
    </>
  );
}
