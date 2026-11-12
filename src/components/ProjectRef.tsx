"use client";

import { highlightProject, openProject } from "@/lib/store";

/** A project id chip. Hover cross-highlights the project everywhere, click opens its detail sheet. */
export function ProjectRef({
  id,
  name,
  openLabel,
}: {
  id: string;
  name: string;
  openLabel: string;
}) {
  return (
    <button
      type="button"
      className="pref"
      data-pid={id}
      aria-label={`${openLabel} ${id} ${name}`}
      onClick={() => openProject(id)}
      onPointerEnter={() => highlightProject(id)}
      onPointerLeave={() => highlightProject(null)}
      onFocus={() => highlightProject(id)}
      onBlur={() => highlightProject(null)}
    >
      <span>
        {id} {name}
      </span>
    </button>
  );
}
