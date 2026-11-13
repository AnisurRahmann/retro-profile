import type { Metadata } from "next";
import { ui } from "@/content";
import { Footer } from "@/components/Footer";
import { ScoreRow } from "@/components/ScoreRow";
import { TopBar } from "@/components/TopBar";
import { allNotes } from "@/lib/notes";

export const metadata: Metadata = {
  title: ui.notes.metaTitle,
  description: ui.notes.metaDescription,
  alternates: { canonical: "/notes/" },
};

export default function NotesIndex() {
  const notes = allNotes();
  return (
    <>
      <TopBar base="/" />
      <main id="main" className="wrap pb-16 pt-[calc(var(--bar-h)+2rem)]">
        <h1 className="sr-only">
          {ui.notes.title}: {ui.notes.plain}
        </h1>
        <ScoreRow sub name={ui.notes.title} plain={ui.notes.plain} count={`${notes.length} ${ui.notes.entries}`} headingId="h-notes" />
        <ol className="mt-6 border-2 border-iron">
          {notes.map((note) => (
            <li key={note.slug} className="border-b-2 border-iron last:border-b-0">
              <a
                href={`/notes/${note.slug}/`}
                className="grid gap-x-6 gap-y-1 p-4 no-underline hover:bg-chalk-2 md:grid-cols-[8rem_minmax(0,1fr)_auto] md:items-baseline"
                data-note
              >
                <span className="label steel">
                  {note.date} {note.year}
                </span>
                <span>
                  <span className="display block text-3xl md:text-4xl">{note.title}</span>
                  <span className="prose-line mt-2 block">{note.excerpt}</span>
                </span>
                <span className="label steel">
                  {note.cat} · {note.read} {ui.notes.read}
                </span>
              </a>
            </li>
          ))}
        </ol>
      </main>
      <Footer now={new Date()} />
    </>
  );
}
