import type { BusId, Count, Project, StatusId } from "@/content.schema";
import { STATUS_IDS } from "@/content.ids";

/** Status counters are always computed from data, never typed by hand. */
export function statusCounts(
  projects: readonly Pick<Project, "status">[],
): Record<StatusId, number> {
  const counts = Object.fromEntries(STATUS_IDS.map((s) => [s, 0])) as Record<StatusId, number>;
  for (const p of projects) counts[p.status] += 1;
  return counts;
}

export type WirePair = { a: string; b: string };

/** Unique undirected connections, ordered by id. */
export function wirePairs(projects: readonly Pick<Project, "id" | "connectsTo">[]): WirePair[] {
  const seen = new Set<string>();
  const out: WirePair[] = [];
  for (const p of projects) {
    for (const t of p.connectsTo) {
      const [a, b] = p.id < t ? [p.id, t] : [t, p.id];
      const key = `${a}|${b}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ a, b });
    }
  }
  return out.sort((x, y) => (x.a + x.b).localeCompare(y.a + y.b));
}

export function byBus<T extends { bus: BusId }>(projects: readonly T[], order: readonly BusId[]) {
  return order.map((bus) => ({ bus, items: projects.filter((p) => p.bus === bus) }));
}

export function formatCount(c: Count, value: number = c.value): string {
  const n = Math.round(value);
  const body = c.group ? n.toLocaleString("en-US") : String(n);
  return `${c.prefix}${body}${c.suffix}`;
}

export function sheetId(no: string): string {
  return `sheet-${no}`;
}

export function period(from: string, to: string | null, fromLabel: string, joiner: string): string {
  return to === null ? `${fromLabel} ${from}` : `${from} ${joiner} ${to}`;
}
