import { CardSection } from "@/components/CardSection";
import { Closer } from "@/components/Closer";
import { Portrait } from "@/components/Portrait";
import { ReceiptCard } from "@/components/ReceiptCard";
import { StatusLine } from "@/components/StatusLine";
import { SkyLabel } from "@/components/sky/SkyLabel";
import { SkyStage } from "@/components/sky/SkyStage";
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
      <SkyStage copy={ui.sky}>
        {/* Mobile: a 56px portrait beside the name, the rest full width under them (the stage stays open sky).
            Desktop: the 88px portrait beside the whole block. */}
        <div className="grid grid-cols-[56px_minmax(0,1fr)] items-center gap-x-4 sm:grid-cols-[88px_minmax(0,1fr)] sm:gap-x-6">
          <div className="sm:row-span-2 max-sm:[&>*]:!size-14 max-sm:[&>*]:!text-[17px]">
            <Portrait size={88} priority />
          </div>
          <h1 className="text-[36px] leading-10 font-medium tracking-[-0.02em] text-text sm:self-end">
            {profile.name}
          </h1>
          <div className="col-span-2 mt-3 min-w-0 sm:col-span-1 sm:col-start-2 sm:mt-0 sm:self-start">
            <p className="mt-0 flex min-h-14 items-start gap-2.5 text-lg leading-7 text-on-sky sm:mt-2 sm:min-h-7">
              <span className="flex h-7 items-center">
                <Waveform />
              </span>
              <StatusLine lines={profile.statusLines} />
            </p>
            <p className="mt-1 text-sm text-on-sky">{profile.oneLiner}</p>
            <SkyLabel copy={ui.sky} />
          </div>
        </div>
      </SkyStage>

      <CardSection id="shipped" heading={ui.home.shipped} items={shipped} />
      <CardSection id="bench" heading={ui.home.bench} items={building} />

      {receipts.length > 0 ? (
        <section id="receipts" aria-labelledby="receipts-heading" className="section">
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
