/**
 * Resolving a task from whatever the model typed.
 *
 * A model says "bathroom clean", not a uuid. Rather than guessing, this returns
 * an explicit ambiguity error listing the candidates — a tool that fails with
 * "did you mean one of these three" gets a correct second call, where one that
 * silently picks the first match completes the wrong task.
 */
import type { Task } from "../src/lib/types";

export type Lookup =
  | { ok: true; task: Task }
  | { ok: false; message: string };

const norm = (s: string) => s.trim().toLowerCase();

export function resolveTask(tasks: Task[], query: string): Lookup {
  const q = norm(query);
  if (!q) return { ok: false, message: "No task name or id given." };

  const byId = tasks.find((t) => t.id === query.trim());
  if (byId) return { ok: true, task: byId };

  const exact = tasks.filter((t) => norm(t.name) === q);
  if (exact.length === 1) return { ok: true, task: exact[0] };
  if (exact.length > 1) return { ok: false, message: ambiguous(query, exact) };

  const partial = tasks.filter((t) => norm(t.name).includes(q));
  if (partial.length === 1) return { ok: true, task: partial[0] };
  if (partial.length > 1) return { ok: false, message: ambiguous(query, partial) };

  const words = q.split(/\s+/).filter(Boolean);
  const loose = tasks.filter((t) => words.every((w) => norm(t.name).includes(w)));
  if (loose.length === 1) return { ok: true, task: loose[0] };
  if (loose.length > 1) return { ok: false, message: ambiguous(query, loose) };

  return {
    ok: false,
    message: `No task matches "${query}". Active tasks include: ${tasks
      .filter((t) => t.status === "active")
      .slice(0, 12)
      .map((t) => t.name)
      .join(", ")}`,
  };
}

function ambiguous(query: string, matches: Task[]): string {
  const names = matches.map((t) => `"${t.name}" (${t.id})`).join(", ");
  return `"${query}" matches ${matches.length} tasks: ${names}. Use the exact name or the id.`;
}
