import { buses, ui } from "@/content";
import { stations } from "@/scene";

/** The same links as the room, as a plain list: for no-JS, screen readers and print. */
export function SectionList() {
  const g = ui.garage;
  return (
    <section id="section-list" className="wrap garage-list" aria-labelledby="h-section-list">
      <h2 id="h-section-list" className="label">
        <b>{g.listTitle}</b> <span className="plain">{g.listPlain}</span>
      </h2>
      <ol>
        {stations
          .filter((station) => station.href)
          .map((station) => (
            <li key={station.id}>
              <a href={station.href!}>
                <b>{station.label}</b>
                <span className="plain">{station.plain}</span>
              </a>
              {station.id === "rack" ? (
                <p className="label">
                  {g.plates} <span className="plain">{g.platesPlain}</span>: {buses.map((bus) => bus.name).join(", ")}
                </p>
              ) : null}
            </li>
          ))}
      </ol>
      <a href="/log/" className="btn mt-5">
        <span>{g.fullLog}</span>
        <span className="plain">{g.fullLogPlain}</span>
      </a>
    </section>
  );
}
