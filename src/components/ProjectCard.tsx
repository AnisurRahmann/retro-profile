import Link from "next/link";
import { projectHref, type CardProject, type StatusLabels } from "@/lib/project";
import { Tile } from "./Tile";

function StatusChip({ status, labels }: { status: NonNullable<CardProject["status"]>; labels: StatusLabels }) {
  const live = status === "in-build";
  return (
    <span className="ml-auto flex flex-none items-center gap-1.5 self-center font-mono text-xs whitespace-nowrap text-graphite">
      <span
        aria-hidden="true"
        className="inline-block size-1.5 rounded-full"
        style={{ background: live ? "var(--signal)" : "var(--graphite)" }}
      />
      {live ? labels.inBuild : labels.built}
    </span>
  );
}

/** Pure card: usable from server pages and the client chat. */
export function ProjectCard({ project, labels }: { project: CardProject; labels: StatusLabels }) {
  const target = projectHref(project);
  const body = (
    <>
      <Tile id={project.id} title={project.title} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm leading-5 font-medium text-text">{project.title}</span>
        <span className="block text-sm leading-5 text-graphite">{project.subtitle}</span>
      </span>
      {project.status ? <StatusChip status={project.status} labels={labels} /> : null}
    </>
  );

  if (!target) return <div className="card h-full">{body}</div>;
  if (target.external) {
    return (
      <a href={target.href} target="_blank" rel="noopener" className="card h-full">
        {body}
      </a>
    );
  }
  return (
    <Link href={target.href} className="card h-full">
      {body}
    </Link>
  );
}
