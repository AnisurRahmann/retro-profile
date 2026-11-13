import {
  blocks,
  buses,
  CHART_START_YEAR,
  flights,
  goals,
  metrics,
  misses,
  principles,
  projectById,
  projects,
  scenarios,
  statusById,
  statuses,
  ui,
} from "@/content";
import { GYM_RULES } from "@/gym";
import type { Block, Bus, Flight, Goal, Project, Status, StatusId } from "@/schema";

/** Everything here is computed from content. No counter is typed by hand. */

export function flight(id: string): Flight {
  const found = flights.find((entry) => entry.id === id);
  if (!found) throw new Error(`unknown flight "${id}"`);
  return found;
}

export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

export function statusLabel(status: Status): string {
  return `${status.call} · ${status.plain}`;
}

export function projectsByBus(): { bus: Bus; projects: Project[] }[] {
  return buses.map((bus) => ({ bus, projects: projects.filter((project) => project.bus === bus.id) }));
}

export function countByStatus(status: StatusId): number {
  return projects.filter((project) => project.status === status).length;
}

export const projectStatuses: Status[] = statuses.filter((status) => status.id !== "failed");

export const counts = {
  projects: projects.length,
  shipped: countByStatus("shipped"),
  metrics: metrics.length,
  blocks: blocks.length,
  scenarios: scenarios.length,
  rules: GYM_RULES.length + principles.length,
  goals: goals.length,
  misses: misses.length,
};

export function goalCurrent(goal: Goal): string {
  const current = goal.current;
  if (current.kind === "text") return current.text;
  if (current.kind === "count-status") return `${countByStatus(current.status)} ${current.suffix}`;
  return statusLabel(statusById(projectById(current.projectId).status));
}

// ── Training blocks chart ────────────────────────────────────

function monthIndex(yearMonth: string): number {
  const [year, month] = yearMonth.split("-").map(Number) as [number, number];
  return (year - CHART_START_YEAR) * 12 + (month - 1);
}

export function chartModel(now: Date) {
  const nowIndex = (now.getUTCFullYear() - CHART_START_YEAR) * 12 + now.getUTCMonth() + 1;
  const total = Math.max(nowIndex, 12);
  const pct = (index: number) => Math.round((Math.min(index, total) / total) * 10000) / 100;
  const years: { year: number; left: number }[] = [];
  for (let year = CHART_START_YEAR; (year - CHART_START_YEAR) * 12 < total; year += 1) {
    years.push({ year, left: pct((year - CHART_START_YEAR) * 12) });
  }
  const rows = [...blocks]
    .sort((a, b) => a.n - b.n)
    .map((block: Block) => {
      const start = monthIndex(block.start);
      const end = block.end ? monthIndex(block.end) + 1 : total;
      return { block, left: pct(start), width: Math.round((pct(end) - pct(start)) * 100) / 100, open: !block.end };
    });
  return { years, rows };
}

export function sinceYear(): number {
  return Math.min(...blocks.map((block) => Number(block.start.slice(0, 4))));
}

export { ui };
