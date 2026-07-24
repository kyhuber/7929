export type TaskKind = "recurring" | "project";

export type TaskCategory =
  | "kitchen"
  | "bathroom"
  | "bedroom"
  | "living"
  | "laundry"
  | "exterior"
  | "systems"
  | "admin";

export type TaskPriority = "next" | "soon" | "someday";

export type TaskStatus = "active" | "done" | "archived";

export interface SeasonalOverride {
  /** calendar months, 1–12 */
  months: number[];
  interval_days: number;
}

export interface Task {
  id: string;
  kind: TaskKind;
  name: string;
  category: TaskCategory;
  steps: string[];
  base_interval_days: number | null;
  seasonal_overrides: SeasonalOverride[] | null;
  /** months (1–12) the task is due-able; null = year-round */
  active_months: number[] | null;
  est_minutes: number | null;
  last_completed_at: string | null;
  snooze_until: string | null;
  priority: TaskPriority | null;
  status: TaskStatus;
  location: string | null;
  materials: string | null;
  notes: string | null;
  created_at: string;
}

export interface Completion {
  id: string;
  task_id: string;
  completed_at: string;
  notes: string | null;
}

export const CATEGORIES: TaskCategory[] = [
  "kitchen",
  "bathroom",
  "bedroom",
  "living",
  "laundry",
  "exterior",
  "systems",
  "admin",
];

export const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;
