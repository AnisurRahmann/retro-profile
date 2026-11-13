import { existsSync } from "node:fs";
import { join } from "node:path";
import { meta, profile } from "@/content";
import { ActualLog } from "@/components/ActualLog";
import { Contact } from "@/components/Contact";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { LoadTheBar } from "@/components/LoadTheBar";
import { NextBlock } from "@/components/NextBlock";
import { NoLift } from "@/components/NoLift";
import { PrBoard } from "@/components/PrBoard";
import { Knurl } from "@/components/ScoreRow";
import { TopBar } from "@/components/TopBar";
import { TrainingBlocks } from "@/components/TrainingBlocks";
import { TrainingRules } from "@/components/TrainingRules";
import { YourCall } from "@/components/YourCall";

const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: profile.name,
  alternateName: profile.alias,
  jobTitle: meta.jobTitle,
  description: profile.summary,
  url: profile.site,
  email: profile.links.email.href,
  address: { "@type": "PostalAddress", addressLocality: "Sylhet", addressCountry: "BD" },
  sameAs: [profile.links.github.href, profile.links.linkedin.href],
};

export default function Home() {
  const now = new Date();
  const hasResume = existsSync(join(process.cwd(), "public", "resume.pdf"));
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }} />
      <TopBar />
      <main id="main">
        <Hero />
        <Knurl />
        <PrBoard />
        <Knurl />
        <div>
          <TrainingBlocks now={now} />
          <div className="wrap -mt-8 pb-14 md:-mt-10 md:pb-20">
            <YourCall />
          </div>
        </div>
        <Knurl />
        <LoadTheBar />
        <Knurl />
        <TrainingRules />
        <Knurl />
        <NextBlock />
        <Knurl />
        <NoLift />
        <Knurl />
        <ActualLog />
        <Knurl />
        <Contact hasResume={hasResume} />
      </main>
      <Footer now={now} />
    </>
  );
}
