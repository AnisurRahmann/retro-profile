"use client";

import { useSyncExternalStore } from "react";

/** Which project's detail sheet is open. One tiny store shared by the map, register and drawer. */
let selected: string | null = null;
const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function openProject(id: string): void {
  selected = id;
  listeners.forEach((l) => l());
}

export function closeProject(): void {
  selected = null;
  listeners.forEach((l) => l());
}

export function useSelectedProject(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => selected,
    () => null,
  );
}

/**
 * Cross-highlighting is done in the DOM, not in React state: hovering a project
 * anywhere marks every element for that project (map node, wires, register row)
 * without re-rendering either island.
 */
export function highlightProject(id: string | null): void {
  const root = document.documentElement;
  document
    .querySelectorAll(".is-hl, .is-near")
    .forEach((el) => el.classList.remove("is-hl", "is-near"));
  if (!id) {
    delete root.dataset.hl;
    return;
  }
  root.dataset.hl = id;
  document
    .querySelectorAll(`[data-pid="${id}"], [data-wire~="${id}"]`)
    .forEach((el) => el.classList.add("is-hl"));
  document.querySelectorAll(`[data-near~="${id}"]`).forEach((el) => el.classList.add("is-near"));
}
