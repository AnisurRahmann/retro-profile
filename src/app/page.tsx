import { links, meta, profile, SITE_URL, ui } from "@/content";
import { validateContent } from "@/lib/validate";
import { Drawer } from "@/components/Drawer";
import { Runtime } from "@/components/Runtime";
import {
  Colophon,
  Sheet00,
  Sheet01,
  Sheet02,
  Sheet03,
  Sheet04,
  Sheet05,
  Sheet06,
  Sheet07,
} from "@/components/sheets";

export default function Page() {
  // Fails the build if src/content.ts is invalid.
  const content = validateContent();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: profile.name,
    alternateName: profile.alias,
    jobTitle: meta.jobTitle,
    description: profile.summary,
    url: SITE_URL,
    email: links.email.href,
    address: { "@type": "PostalAddress", addressLocality: "Sylhet", addressCountry: "BD" },
    knowsAbout: meta.knowsAbout,
    sameAs: [links.github.href, links.linkedin.href],
  };

  return (
    <>
      <main id="drawing">
        <Sheet00 content={content} />
        <Sheet01 content={content} />
        <Sheet02 content={content} />
        <Sheet03 content={content} />
        <Sheet04 content={content} />
        <Sheet05 content={content} />
        <Sheet06 content={content} />
        <Sheet07 content={content} />
      </main>
      <Colophon />
      <Drawer
        projects={content.projects}
        buses={content.buses}
        statuses={content.statuses}
        copy={ui.drawer}
        external={ui.external}
      />
      <Runtime sheetNos={content.sheets.map((s) => s.no)} label={ui.sheet} of={ui.of} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
