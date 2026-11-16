import { meta, profile } from "@/content";
import { Footer } from "@/components/Footer";
import { GarageHeader } from "@/components/garage/GarageHeader";
import { GarageRuntime } from "@/components/garage/GarageRuntime";
import { Scene } from "@/components/garage/Scene";
import { SectionList } from "@/components/garage/SectionList";

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

/** The garage gym: text block first, then the room, then the same links as a plain list. */
export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }} />
      <main id="main">
        <GarageHeader />
        <Scene />
        <SectionList />
      </main>
      <Footer now={new Date()} />
      <GarageRuntime />
    </>
  );
}
