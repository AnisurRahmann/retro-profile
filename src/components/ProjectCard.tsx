import Link from "next/link";
import type { BenchItem, Project } from "@/content.schema";
import { projectHref, ui } from "@/site";
import { Tile } from "./Tile";

function StatusChip({ status }: { status: BenchItem["status"] }) {
  const live = status === "in-build";
  return (
    <span className="ml-auto flex flex-none items-center gap-1.5 self-center font-mono text-xs whitespace-nowrap text-graphite">
      <span
        aria-hidden="true"
        className="inline-block size-1.5 rounded-full"
        style={{ background: live ? "var(--signal)" : "var(--graphite)" }}
      />
      {live ? ui.home.statusInBuild : ui.home.statusBuilt}
    </span>
  );
}

export function ProjectCard({ project }: { project: Project | BenchItem }) {
  const target = projectHref(project);
  const body = (
    <>
      <Tile id={project.id} title={project.title} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm leading-5 font-medium text-text">{project.title}</span>
        <span className="block text-sm leading-5 text-graphite">{project.subtitle}</span>
      </span>
      {"status" in project ? <StatusChip status={project.status} /> : null}
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
