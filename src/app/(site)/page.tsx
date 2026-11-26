import { CardSection } from "@/components/CardSection";
import { Closer } from "@/components/Closer";
import { hasPortrait, Portrait } from "@/components/Portrait";
import { ReceiptCard } from "@/components/ReceiptCard";
import { StatusLine } from "@/components/StatusLine";
import { SkyFallbackBand, SkyFallbackStage } from "@/components/sky/SkyFallback";
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
  const photo = hasPortrait();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd).replace(/</g, "\\u003c") }}
      />
      {/* First-paint fallback (v5.1 T8) for the fixed band (from 1100px), under the canvases (z −3). It is fixed, so it
          can stand anywhere: here, before the stage, because the first section's margin goes by the stage's next
          sibling (globals.css `main > .sky-stage + .section`) and must not wait for this to be removed. */}
      <SkyFallbackBand />
      <SkyStage copy={ui.sky} fallback={<SkyFallbackStage />}>
        {/* Mobile: a 56px portrait beside the name, the rest full width under them; without a photo (the initials
            fallback) the avatar is hidden below 640px and the name comes first. Desktop: the 88px portrait beside
            the whole block. */}
        <div
          className={`grid grid-cols-[56px_minmax(0,1fr)] items-center gap-x-4 sm:grid-cols-[88px_minmax(0,1fr)] sm:gap-x-6${photo ? "" : " max-sm:grid-cols-1"}`}
        >
          <div className={`sm:row-span-2 max-sm:[&>*]:!size-14 max-sm:[&>*]:!text-[17px]${photo ? "" : " max-sm:hidden"}`}>
            <Portrait size={88} priority />
          </div>
          <h1 className="w-fit text-[36px] leading-10 font-medium tracking-[-0.02em] text-text sm:self-end" data-on-sky="name">
            {profile.name}
          </h1>
          <div className={`mt-3 min-w-0 sm:col-span-1 sm:col-start-2 sm:mt-0 sm:self-start${photo ? " col-span-2" : " max-sm:mt-2"}`}>
            {/* One line of status (24px on phones: the short lines never wrap), then the one-liner 4px under it. */}
            <p className="mt-0 flex min-h-6 items-start gap-2.5 text-base leading-6 text-on-sky sm:mt-2 sm:min-h-7 sm:text-lg sm:leading-7">
              <span className="flex h-6 items-center sm:h-7">
                <Waveform />
              </span>
              <StatusLine lines={profile.statusLines} short={profile.statusLinesShort} />
            </p>
            <p className="mt-1 w-fit text-sm text-on-sky" data-on-sky="one-liner">
              {profile.oneLiner}
            </p>
            <SkyLabel copy={ui.sky} />
          </div>
        </div>
      </SkyStage>

      <CardSection id="shipped" heading={ui.home.shipped} items={shipped} />
      <CardSection id="bench" heading={ui.home.bench} items={building} />

      {receipts.length > 0 ? (
        <section id="receipts" aria-labelledby="receipts-heading" className="section">
          <h2 id="receipts-heading" className="mb-4 w-fit text-base font-medium text-text" data-on-sky="h-receipts">
            {ui.home.receipts}
          </h2>
          <div className="masonry">
            {receipts.map((r) => (
              <ReceiptCard key={r.id} receipt={r} />
            ))}
          </div>
          <p className="mt-2 w-fit font-mono text-xs leading-5 text-graphite" data-on-sky="receipts-note">
            {ui.home.receiptsNote}
          </p>
        </section>
      ) : null}

      <Closer />
      {/* Scene mode (< 1100px): the closing scene, the city and the airport (the renderer draws into this slot). */}
      <div aria-hidden="true" className="sky-scene sky-scene-closing" data-sky-scene="closing" />
    </>
  );
}
