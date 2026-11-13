import { ui } from "@/content";
import type { LegalDoc } from "@/lib/legal";

/** Plain document page, no portfolio chrome: these URLs are read by Meta's crawler and by app users. */
export function LegalPage({ doc }: { doc: LegalDoc }) {
  return (
    <main id="main" className="wrap pb-16 pt-10">
      <article className="mx-auto max-w-3xl">
        <p className="label steel border-b-2 border-iron pb-2">
          {ui.legal.updated} {doc.updated}
        </p>
        <h1 className="display mt-6 text-6xl md:text-7xl">{doc.heading}</h1>
        <p className="mt-4 text-xl font-semibold">{doc.lede}</p>
        <div className="legal mt-8" dangerouslySetInnerHTML={{ __html: doc.html }} />
        <p className="label mt-10 border-t-2 border-iron pt-3">
          <a href="/" className="inline-flex min-h-9 items-center">
            {ui.legal.back}
          </a>
        </p>
      </article>
    </main>
  );
}
