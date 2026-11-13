import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ui } from "@/content";
import { Footer } from "@/components/Footer";
import { TopBar } from "@/components/TopBar";
import { allNotes, noteBySlug } from "@/lib/notes";

type Params = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return allNotes().map((note) => ({ slug: note.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const note = noteBySlug((await params).slug);
  if (!note) return {};
  return {
    title: `${note.title} · ${ui.notes.title}`,
    description: note.excerpt,
    alternates: { canonical: `/notes/${note.slug}/` },
    openGraph: { type: "article", title: note.title, description: note.excerpt, url: `/notes/${note.slug}/`, images: ["/og.png"] },
  };
}

export default async function NotePage({ params }: Params) {
  const note = noteBySlug((await params).slug);
  if (!note) notFound();
  const lead = note.chapters.find((chapter) => chapter.kind === "title");
  return (
    <>
      <TopBar base="/" />
      <main id="main" className="wrap pb-16 pt-[calc(var(--bar-h)+2rem)]">
        <article className="note-body mx-auto max-w-3xl">
          <p className="label flex flex-wrap justify-between gap-2 border-b-2 border-iron pb-2">
            <a href="/notes/" className="font-semibold">
              ← {ui.notes.back}
            </a>
            <span className="steel">
              {note.date} {note.year} · {note.cat} · {note.read} {ui.notes.read}
            </span>
          </p>
          <h1 className="display mt-6 text-6xl md:text-8xl">{note.title}</h1>
          <p className="mt-4 text-xl font-semibold">{note.excerpt}</p>
          {lead && lead.kind === "title" && lead.sub ? <p className="steel mt-2">{lead.sub}</p> : null}
          <div className="mt-8 grid gap-8">
            {note.chapters.map((chapter, index) => {
              if (chapter.kind === "body")
                return (
                  <section key={index}>
                    {chapter.head ? <h2 className="display text-4xl">{chapter.head}</h2> : null}
                    <p className="mt-2">{chapter.body}</p>
                  </section>
                );
              if (chapter.kind === "quote")
                return (
                  <blockquote key={index} className="note-quote display text-3xl md:text-4xl" style={{ lineHeight: 1 }}>
                    {chapter.q}
                  </blockquote>
                );
              if (chapter.kind === "end" && chapter.href && chapter.cta)
                return (
                  <p key={index}>
                    <a href={chapter.href} className="btn btn-solid">
                      {chapter.cta}
                    </a>
                  </p>
                );
              return null;
            })}
          </div>
        </article>
      </main>
      <Footer now={new Date()} />
    </>
  );
}
