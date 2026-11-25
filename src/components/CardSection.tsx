import type { BenchItem, Project } from "@/content.schema";
import { fill, ui } from "@/site";
import { ProjectCard } from "./ProjectCard";
import { ShowMore } from "./ShowMore";

const VISIBLE = 4;

export function CardSection({
  id,
  heading,
  items,
}: {
  id?: string;
  heading: string;
  items: (Project | BenchItem)[];
}) {
  const visible = items.slice(0, VISIBLE);
  const rest = items.slice(VISIBLE);
  const headingId = `${id ?? heading.toLowerCase().replace(/\W+/g, "-")}-heading`;
  return (
    <section id={id} aria-labelledby={headingId} className="section scroll-mt-6">
      <h2 id={headingId} className="mb-4 text-base font-medium text-text">
        {heading}
      </h2>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {visible.map((p) => (
          <ProjectCard key={p.id} project={p} />
        ))}
      </div>
      {rest.length > 0 ? (
        <ShowMore
          count={rest.length}
          moreLabel={fill(ui.home.showMore, { n: rest.length })}
          lessLabel={ui.home.showLess}
          hidden={rest.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        />
      ) : null}
    </section>
  );
}
