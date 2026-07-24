import type { Task } from "./types";

export type DueBucket = "overdue" | "due" | "upcoming" | "scheduled";

const DAY_MS = 86_400_000;

/** Local-midnight date, so due-ness flips at midnight rather than at
 *  whatever time of day the task was last completed. */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

/** PRD §6: seasonal override wins for the current month, else base. */
export function effectiveIntervalDays(task: Task, date: Date): number | null {
  const month = date.getMonth() + 1;
  for (const override of task.seasonal_overrides ?? []) {
    if (override.months.includes(month)) return override.interval_days;
  }
  return task.base_interval_days;
}

/** active_months gate: null = year-round. */
export function isActiveInMonth(task: Task, date: Date): boolean {
  if (!task.active_months || task.active_months.length === 0) return true;
  return task.active_months.includes(date.getMonth() + 1);
}

export function isSnoozed(task: Task, now: Date): boolean {
  return !!task.snooze_until && new Date(task.snooze_until) > now;
}

export interface DueInfo {
  dueDate: Date;
  daysOverdue: number;
}

/**
 * Due-ness for a recurring task. Null for projects, tasks outside their
 * active months, or tasks with no usable interval.
 * A task never completed is due today (daysOverdue = 0).
 */
export function dueInfo(task: Task, today: Date): DueInfo | null {
  if (task.kind !== "recurring") return null;
  if (!isActiveInMonth(task, today)) return null;

  const interval = effectiveIntervalDays(task, today);
  if (interval == null) return null;

  const todayStart = startOfDay(today);

  if (!task.last_completed_at) {
    return { dueDate: todayStart, daysOverdue: 0 };
  }

  const dueDate = addDays(startOfDay(new Date(task.last_completed_at)), interval);
  const daysOverdue = Math.floor(
    (todayStart.getTime() - dueDate.getTime()) / DAY_MS
  );
  return { dueDate, daysOverdue };
}

/** PRD §6 buckets: ≥1 overdue · 0 due today · −1..−3 coming up · ≤−4 hidden. */
export function bucketFor(daysOverdue: number): DueBucket {
  if (daysOverdue >= 1) return "overdue";
  if (daysOverdue === 0) return "due";
  if (daysOverdue >= -3) return "upcoming";
  return "scheduled";
}

export interface TodayItem {
  task: Task;
  due: DueInfo;
  bucket: DueBucket;
}

/**
 * Classify active recurring tasks into Today-view buckets.
 * Snoozed tasks are suppressed entirely (interval math untouched).
 * Sorted most-overdue first within each bucket.
 */
export function classifyForToday(tasks: Task[], now: Date): TodayItem[] {
  const items: TodayItem[] = [];
  for (const task of tasks) {
    if (task.status !== "active") continue;
    if (isSnoozed(task, now)) continue;
    const due = dueInfo(task, now);
    if (!due) continue;
    items.push({ task, due, bucket: bucketFor(due.daysOverdue) });
  }
  items.sort((a, b) => b.due.daysOverdue - a.due.daysOverdue);
  return items;
}

/** Next task coming up (for the empty state): the least-far-away scheduled/upcoming task. */
export function nextUpcoming(tasks: Task[], now: Date): TodayItem | null {
  const future = classifyForToday(tasks, now).filter(
    (i) => i.due.daysOverdue < 0
  );
  return future.length ? future[0] : null;
}

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Compress a sorted month list into "Apr–Sep" / "Feb, Sep" style ranges. */
export function formatMonths(months: number[]): string {
  if (months.length === 0) return "";
  const sorted = [...months].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i <= sorted.length; i++) {
    const m = sorted[i];
    if (m === prev + 1) {
      prev = m;
      continue;
    }
    ranges.push(
      start === prev
        ? MONTH_SHORT[start - 1]
        : `${MONTH_SHORT[start - 1]}–${MONTH_SHORT[prev - 1]}`
    );
    start = m;
    prev = m;
  }
  return ranges.join(", ");
}

/** Human cadence line for list rows: "every 7d · 10d Apr–Sep". */
export function formatCadence(task: Task): string {
  if (task.kind !== "recurring") return "";
  const parts: string[] = [];
  if (task.base_interval_days != null) {
    parts.push(`every ${task.base_interval_days}d`);
  }
  for (const o of task.seasonal_overrides ?? []) {
    parts.push(`${o.interval_days}d ${formatMonths(o.months)}`);
  }
  if (task.active_months && task.active_months.length > 0) {
    parts.push(formatMonths(task.active_months) + " only");
  }
  return parts.join(" · ");
}

export function formatDaysOverdue(daysOverdue: number): string {
  if (daysOverdue >= 1) return `${daysOverdue}d overdue`;
  if (daysOverdue === 0) return "due today";
  if (daysOverdue === -1) return "tomorrow";
  return `in ${-daysOverdue}d`;
}
