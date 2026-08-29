/**
 * Rendering tasks as text for a model to read.
 *
 * Tool results go back as prose, not JSON: the model reads "3d overdue" more
 * reliably than it reads a timestamp it has to subtract from today. Anything
 * needing exact values (ids, for a follow-up call) is included verbatim.
 */
import type { Completion, Task } from "../src/lib/types";
import {
  formatCadence,
  formatDaysOverdue,
  type TodayItem,
} from "../src/lib/dueness";
import type { IntervalStats } from "./analysis";

const mins = (t: Task) => (t.est_minutes != null ? `${t.est_minutes}min` : "—");
const day = (iso: string) => new Date(iso).toISOString().slice(0, 10);

export function formatTodayItem(item: TodayItem): string {
  const { task, due } = item;
  return `- ${task.name} · ${task.category} · ${mins(task)} · ${formatDaysOverdue(
    due.daysOverdue
  )}`;
}

export function formatToday(items: TodayItem[], maxMinutes?: number): string {
  const filter = maxMinutes ?? null;
  const scoped =
    filter == null
      ? items
      : items.filter((i) => i.task.est_minutes != null && i.task.est_minutes <= filter);

  const overdue = scoped.filter((i) => i.bucket === "overdue");
  const dueToday = scoped.filter((i) => i.bucket === "due");
  const upcoming = scoped.filter((i) => i.bucket === "upcoming");

  const sections: string[] = [];
  if (overdue.length) {
    sections.push(`Overdue (${overdue.length})\n${overdue.map(formatTodayItem).join("\n")}`);
  }
  if (dueToday.length) {
    sections.push(`Due today (${dueToday.length})\n${dueToday.map(formatTodayItem).join("\n")}`);
  }
  if (upcoming.length) {
    sections.push(`Coming up (${upcoming.length})\n${upcoming.map(formatTodayItem).join("\n")}`);
  }

  if (!sections.length) {
    const suffix = filter != null ? ` under ${filter} minutes` : "";
    return `Nothing due${suffix}. The project backlog is the place to look next.`;
  }
  const header = filter != null ? `Filtered to tasks of ${filter} minutes or less.\n\n` : "";
  return header + sections.join("\n\n");
}

export function formatProjects(projects: Task[]): string {
  if (!projects.length) return "No open projects.";
  const order = ["next", "soon", "someday"] as const;
  const groups: Record<(typeof order)[number], Task[]> = {
    next: [],
    soon: [],
    someday: [],
  };
  for (const p of projects) groups[p.priority ?? "someday"].push(p);

  return order
    .filter((k) => groups[k].length)
    .map((k) => {
      const rows = groups[k].map((p) => {
        const bits = [p.location, mins(p), p.materials ? `needs: ${p.materials}` : null]
          .filter(Boolean)
          .join(" · ");
        return `- ${p.name}${bits ? ` · ${bits}` : ""}`;
      });
      return `${k[0].toUpperCase()}${k.slice(1)} (${groups[k].length})\n${rows.join("\n")}`;
    })
    .join("\n\n");
}

export function formatTaskDetail(
  task: Task,
  due: { dueDate: Date; daysOverdue: number } | null,
  history: Pick<Completion, "completed_at" | "notes">[]
): string {
  const lines = [
    `${task.name} — ${task.kind}, ${task.category}${
      task.status !== "active" ? ` (${task.status})` : ""
    }`,
    `id: ${task.id}`,
  ];

  const cadence = formatCadence(task);
  if (cadence) lines.push(`Cadence: ${cadence}`);
  if (task.priority) lines.push(`Priority: ${task.priority}`);
  if (task.est_minutes != null) lines.push(`Estimate: ${task.est_minutes} min`);
  if (task.location) lines.push(`Location: ${task.location}`);
  if (task.materials) lines.push(`Materials: ${task.materials}`);

  lines.push(
    `Last completed: ${task.last_completed_at ? day(task.last_completed_at) : "never"}`
  );
  if (due) {
    lines.push(
      `Next due: ${due.dueDate.toISOString().slice(0, 10)} (${formatDaysOverdue(
        due.daysOverdue
      )})`
    );
  }
  if (task.snooze_until && new Date(task.snooze_until) > new Date()) {
    lines.push(`Snoozed until: ${day(task.snooze_until)}`);
  }
  if (task.notes) lines.push(`Notes: ${task.notes}`);

  if (task.steps.length) {
    lines.push("", "Steps (reference only — a session is the unit of tracking):");
    lines.push(...task.steps.map((s) => `  - ${s}`));
  }

  if (history.length) {
    lines.push("", `Recent completions (${history.length}):`);
    lines.push(
      ...history.map(
        (c) => `  - ${day(c.completed_at)}${c.notes ? ` — ${c.notes}` : ""}`
      )
    );
  }

  return lines.join("\n");
}

export function formatHistory(
  task: Task,
  stats: IntervalStats,
  history: Pick<Completion, "completed_at" | "notes">[]
): string {
  const lines = [
    `${task.name} — completion history`,
    `id: ${task.id}`,
    `Nominal cadence: ${
      stats.nominalIntervalDays != null ? `${stats.nominalIntervalDays}d` : "none"
    }`,
    `Completions recorded: ${stats.completions}`,
  ];

  if (stats.gaps.length) {
    lines.push(
      `Actual gaps (days, oldest first): ${stats.gaps.join(", ")}`,
      `Median ${stats.medianGap}d · mean ${stats.meanGap}d · range ${stats.minGap}–${stats.maxGap}d`
    );
    if (stats.driftDays != null) {
      lines.push(`Drift vs cadence: ${stats.driftDays > 0 ? "+" : ""}${stats.driftDays}d`);
    }
  }

  lines.push("", stats.verdict);

  if (stats.suggestedIntervalDays != null) {
    lines.push(
      `To apply: update_cadence with base_interval_days = ${stats.suggestedIntervalDays}.`
    );
  }

  const noted = history.filter((c) => c.notes);
  if (noted.length) {
    lines.push("", "Notes left on completions:");
    lines.push(...noted.map((c) => `  - ${day(c.completed_at)}: ${c.notes}`));
  }

  return lines.join("\n");
}
