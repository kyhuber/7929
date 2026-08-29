/**
 * Write operations shared by the web app and the MCP server (see mcp/README.md).
 *
 * The app and the server must stay in agreement about what "completing a task"
 * means, so the rule lives here rather than in the React context: a completion
 * is always a *pair* of writes — a row in `completions` (durable history, PRD
 * §5) and a bump to `tasks.last_completed_at` (the source of due-ness, PRD §6).
 * Do one without the other and the tuning analysis quietly stops matching the
 * app.
 *
 * Everything here throws on failure. Callers decide what that looks like:
 * the app rolls back its optimistic patch and toasts, the MCP server returns
 * an error result to the model.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SeasonalOverride, Task, TaskCategory, TaskPriority } from "./types";

/** Both `@supabase/ssr`'s browser client and a service-role node client fit. */
export type Db = SupabaseClient;

function fail(action: string, error: { message: string } | null): never {
  throw new Error(`${action}: ${error?.message ?? "unknown error"}`);
}

// ---------------------------------------------------------------- reads

export async function fetchTasks(db: Db): Promise<Task[]> {
  const { data, error } = await db
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) fail("Couldn't load tasks", error);
  return (data as Task[]) ?? [];
}

/** Completion history for one task, most recent first. */
export async function fetchCompletions(
  db: Db,
  taskId: string,
  limit = 10
): Promise<{ id: string; completed_at: string; notes: string | null }[]> {
  const { data, error } = await db
    .from("completions")
    .select("id, completed_at, notes")
    .eq("task_id", taskId)
    .order("completed_at", { ascending: false })
    .limit(limit);
  if (error) fail("Couldn't load history", error);
  return data ?? [];
}

// ------------------------------------------------------------ completion

/** The fields a completion changes. Projects drop off the list; recurring
 *  tasks restart their interval and lose any snooze. */
export function completionPatch(
  task: Pick<Task, "kind">,
  completedAt: string
): Partial<Task> {
  return task.kind === "project"
    ? { status: "done", last_completed_at: completedAt }
    : { last_completed_at: completedAt, snooze_until: null };
}

/** The subset of a task that a completion overwrites — enough to undo it. */
export function completionUndoState(
  task: Pick<Task, "last_completed_at" | "snooze_until" | "status">
): Partial<Task> {
  return {
    last_completed_at: task.last_completed_at,
    snooze_until: task.snooze_until,
    status: task.status,
  };
}

export interface CompletionResult {
  completionId: string;
  patch: Partial<Task>;
  completedAt: string;
}

/**
 * Record a completion: history row + due-ness bump, together.
 *
 * Not a transaction — Supabase's REST API has no multi-statement transaction —
 * so on a partial failure we roll the history row back by hand rather than
 * leave a completion pointing at a task that never advanced.
 */
export async function completeTask(
  db: Db,
  task: Pick<Task, "id" | "kind">,
  opts: { completedAt?: string; notes?: string | null } = {}
): Promise<CompletionResult> {
  const completedAt = opts.completedAt ?? new Date().toISOString();
  const patch = completionPatch(task, completedAt);

  const { data: completion, error: cErr } = await db
    .from("completions")
    .insert({ task_id: task.id, completed_at: completedAt, notes: opts.notes ?? null })
    .select("id")
    .single();
  if (cErr) fail("Couldn't complete", cErr);

  const { error: tErr } = await db.from("tasks").update(patch).eq("id", task.id);
  if (tErr) {
    await db.from("completions").delete().eq("id", completion.id);
    fail("Couldn't complete", tErr);
  }

  return { completionId: completion.id, patch, completedAt };
}

/** Reverse a completion: drop the history row, restore the task fields. */
export async function undoCompletion(
  db: Db,
  taskId: string,
  completionId: string,
  previous: Partial<Task>
): Promise<void> {
  const [{ error: cErr }, { error: tErr }] = await Promise.all([
    db.from("completions").delete().eq("id", completionId),
    db.from("tasks").update(previous).eq("id", taskId),
  ]);
  if (cErr || tErr) fail("Couldn't undo", cErr ?? tErr);
}

// --------------------------------------------------------------- writes

/** PRD §6: snoozing suppresses a task from Today without touching interval math. */
export function snoozeUntil(days: number, from: Date = new Date()): string {
  const until = new Date(from);
  until.setDate(until.getDate() + days);
  return until.toISOString();
}

export async function snoozeTask(db: Db, taskId: string, days: number): Promise<string> {
  const until = snoozeUntil(days);
  await updateTask(db, taskId, { snooze_until: until });
  return until;
}

export async function updateTask(
  db: Db,
  id: string,
  patch: Partial<Task>
): Promise<void> {
  const { error } = await db.from("tasks").update(patch).eq("id", id);
  if (error) fail("Save failed", error);
}

export type NewTask = Omit<Partial<Task>, "id" | "created_at"> &
  Pick<Task, "kind" | "name" | "category">;

export async function createTask(db: Db, input: NewTask): Promise<Task> {
  const { data, error } = await db.from("tasks").insert(input).select("*").single();
  if (error) fail("Couldn't add", error);
  return data as Task;
}

/** Quick-add for the project backlog (PRD §7.2): name is the only real input. */
export function projectDefaults(input: {
  name: string;
  est_minutes?: number | null;
  category?: TaskCategory;
  priority?: TaskPriority;
  location?: string | null;
  materials?: string | null;
  notes?: string | null;
}): NewTask {
  return {
    kind: "project",
    name: input.name,
    category: input.category ?? "admin",
    priority: input.priority ?? "soon",
    est_minutes: input.est_minutes ?? null,
    location: input.location ?? null,
    materials: input.materials ?? null,
    notes: input.notes ?? null,
    steps: [],
  };
}

export interface CadencePatch {
  base_interval_days?: number | null;
  seasonal_overrides?: SeasonalOverride[] | null;
  active_months?: number[] | null;
}

/** Rejects the shapes the DB check constraint would reject anyway, but with a
 *  message a model can act on instead of a Postgres error string. */
export function validateCadence(
  task: Pick<Task, "kind">,
  patch: CadencePatch
): string | null {
  if (task.kind !== "recurring") return "Only recurring tasks have a cadence.";
  if ("base_interval_days" in patch && patch.base_interval_days == null) {
    return "A recurring task needs a base_interval_days.";
  }
  if (patch.base_interval_days != null && patch.base_interval_days < 1) {
    return "base_interval_days must be at least 1.";
  }
  for (const o of patch.seasonal_overrides ?? []) {
    if (!o.months?.length) return "Each seasonal override needs at least one month.";
    if (o.months.some((m) => m < 1 || m > 12)) {
      return "Override months must be 1–12.";
    }
    if (!(o.interval_days >= 1)) return "Override interval_days must be at least 1.";
  }
  if (patch.active_months?.some((m) => m < 1 || m > 12)) {
    return "active_months must be 1–12.";
  }
  return null;
}
