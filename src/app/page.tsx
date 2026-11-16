import { profile, ui } from "@/content";

/** Temporary home while the garage scene is built: the full portfolio lives at /log/. */
export default function Home() {
  return (
    <main id="main" className="wrap pb-24 pt-16">
      <h1 className="display text-7xl">{profile.name}</h1>
      <p className="prose-line mt-3 text-xl font-semibold">{profile.line}</p>
      <a href="/log/" className="btn btn-solid mt-6">
        {ui.notFound.back}
      </a>
    </main>
  );
}
