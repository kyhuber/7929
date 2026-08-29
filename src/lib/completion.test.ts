/**
 * The completion dual-write is the one invariant the app and the MCP server
 * both depend on: a completion is a `completions` row AND a bump to
 * `tasks.last_completed_at`. If either half can go missing, due-ness and the
 * history-based cadence analysis silently drift apart.
 *
 * These use a stand-in for the Supabase query builder so the rule is pinned
 * without needing a database.
 */
import { describe, expect, it } from "vitest";
import { completeTask, undoCompletion, type Db } from "./mutations";

interface Call {
  table: string;
  op: "insert" | "update" | "delete";
  payload?: Record<string, unknown>;
}

function fakeDb(fail: { insert?: boolean; taskUpdate?: boolean } = {}) {
  const calls: Call[] = [];
  const db = {
    from(table: string) {
      return {
        insert(payload: Record<string, unknown>) {
          calls.push({ table, op: "insert", payload });
          return {
            select: () => ({
              single: async () =>
                fail.insert
                  ? { data: null, error: { message: "insert boom" } }
                  : { data: { id: "completion-1" }, error: null },
            }),
          };
        },
        update(payload: Record<string, unknown>) {
          calls.push({ table, op: "update", payload });
          return {
            eq: async () =>
              fail.taskUpdate && table === "tasks"
                ? { error: { message: "update boom" } }
                : { error: null },
          };
        },
        delete() {
          calls.push({ table, op: "delete" });
          return { eq: async () => ({ error: null }) };
        },
      };
    },
  } as unknown as Db;
  return { db, calls };
}

const task = { id: "task-1", kind: "recurring" as const };

describe("completeTask", () => {
  it("writes the history row and the due-ness bump together", async () => {
    const { db, calls } = fakeDb();
    const result = await completeTask(db, task, { notes: "grout dingy" });

    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({
      table: "completions",
      op: "insert",
      payload: { task_id: "task-1", notes: "grout dingy" },
    });
    expect(calls[1]).toMatchObject({
      table: "tasks",
      op: "update",
      payload: { last_completed_at: result.completedAt, snooze_until: null },
    });
    expect(result.completionId).toBe("completion-1");
  });

  it("marks a project done rather than restarting an interval", async () => {
    const { db, calls } = fakeDb();
    await completeTask(db, { id: "p1", kind: "project" });
    expect(calls[1].payload).toMatchObject({ status: "done" });
  });

  it("removes the history row when the task update fails", async () => {
    const { db, calls } = fakeDb({ taskUpdate: true });
    await expect(completeTask(db, task)).rejects.toThrow(/update boom/);

    // insert → failed update → compensating delete, so no orphan completion.
    expect(calls.map((c) => `${c.table}.${c.op}`)).toEqual([
      "completions.insert",
      "tasks.update",
      "completions.delete",
    ]);
  });

  it("never touches the task when the history row fails to write", async () => {
    const { db, calls } = fakeDb({ insert: true });
    await expect(completeTask(db, task)).rejects.toThrow(/insert boom/);
    expect(calls.map((c) => `${c.table}.${c.op}`)).toEqual(["completions.insert"]);
  });

  it("honours a caller-supplied completion time", async () => {
    const { db, calls } = fakeDb();
    const at = "2026-06-01T00:00:00.000Z";
    const result = await completeTask(db, task, { completedAt: at });
    expect(result.completedAt).toBe(at);
    expect(calls[0].payload).toMatchObject({ completed_at: at });
  });
});

describe("undoCompletion", () => {
  it("drops the history row and restores the overwritten fields", async () => {
    const { db, calls } = fakeDb();
    const previous = {
      last_completed_at: "2026-05-01T00:00:00.000Z",
      snooze_until: null,
      status: "active" as const,
    };
    await undoCompletion(db, "task-1", "completion-1", previous);

    expect(calls).toEqual(
      expect.arrayContaining([
        { table: "completions", op: "delete" },
        { table: "tasks", op: "update", payload: previous },
      ])
    );
  });
});
