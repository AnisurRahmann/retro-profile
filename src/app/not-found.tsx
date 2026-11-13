import { statusById, ui } from "@/content";
import { Lights } from "@/components/Lights";
import { TopBar } from "@/components/TopBar";

export default function NotFound() {
  const t = ui.notFound;
  return (
    <>
      <TopBar base="/" />
      <main id="main" className="wrap pb-24 pt-28">
        <Lights status={statusById("failed")} />
        <h1 className="display mt-4 text-8xl">{t.title}</h1>
        <p className="label mt-2">{t.plain}</p>
        <p className="mt-4">{t.body}</p>
        <a href="/" className="btn btn-solid mt-6">
          {t.back}
        </a>
      </main>
    </>
  );
}
