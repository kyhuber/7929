import { describe, expect, it } from "vitest";
import { resolveTask } from "./lookup";
import type { Task } from "../src/lib/types";

function task(overrides: Partial<Task> & Pick<Task, "id" | "name">): Task {
  return {
    kind: "recurring",
    category: "kitchen",
    steps: [],
    base_interval_days: 7,
    seasonal_overrides: null,
    active_months: null,
    est_minutes: 30,
    last_completed_at: null,
    snooze_until: null,
    priority: null,
    status: "active",
    location: null,
    materials: null,
    notes: null,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const tasks = [
  task({ id: "a", name: "Bathroom clean" }),
  task({ id: "b", name: "Kitchen reset" }),
  task({ id: "c", name: "Kitchen deep" }),
  task({ id: "d", name: "Tub scrub", status: "archived" }),
];

describe("resolveTask", () => {
  it("matches an exact id", () => {
    const found = resolveTask(tasks, "c");
    expect(found).toMatchObject({ ok: true, task: { name: "Kitchen deep" } });
  });

  it("matches a name case-insensitively", () => {
    const found = resolveTask(tasks, "  bathroom CLEAN ");
    expect(found).toMatchObject({ ok: true, task: { id: "a" } });
  });

  it("matches a unique substring", () => {
    const found = resolveTask(tasks, "tub");
    expect(found).toMatchObject({ ok: true, task: { id: "d" } });
  });

  it("refuses to guess between ambiguous matches", () => {
    const found = resolveTask(tasks, "kitchen");
    expect(found.ok).toBe(false);
    if (!found.ok) {
      expect(found.message).toMatch(/matches 2 tasks/);
      expect(found.message).toContain("Kitchen reset");
      expect(found.message).toContain("Kitchen deep");
    }
  });

  it("matches on words in any order", () => {
    const found = resolveTask(tasks, "clean bathroom");
    expect(found).toMatchObject({ ok: true, task: { id: "a" } });
  });

  it("lists active tasks when nothing matches", () => {
    const found = resolveTask(tasks, "gutter");
    expect(found.ok).toBe(false);
    if (!found.ok) {
      expect(found.message).toMatch(/No task matches "gutter"/);
      expect(found.message).toContain("Bathroom clean");
      expect(found.message).not.toContain("Tub scrub"); // archived
    }
  });

  it("rejects an empty query", () => {
    expect(resolveTask(tasks, "   ").ok).toBe(false);
  });
});
