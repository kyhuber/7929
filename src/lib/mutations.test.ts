import { describe, expect, it } from "vitest";
import {
  completionPatch,
  completionUndoState,
  projectDefaults,
  snoozeUntil,
  validateCadence,
} from "./mutations";
import type { Task } from "./types";

describe("completionPatch", () => {
  it("restarts a recurring task's interval and clears any snooze", () => {
    const at = "2026-06-01T00:00:00.000Z";
    expect(completionPatch({ kind: "recurring" }, at)).toEqual({
      last_completed_at: at,
      snooze_until: null,
    });
  });

  it("marks a project done so it drops off the backlog", () => {
    const at = "2026-06-01T00:00:00.000Z";
    expect(completionPatch({ kind: "project" }, at)).toEqual({
      status: "done",
      last_completed_at: at,
    });
  });
});

describe("completionUndoState", () => {
  it("captures exactly the fields a completion overwrites", () => {
    const before = {
      last_completed_at: "2026-05-01T00:00:00.000Z",
      snooze_until: "2026-05-08T00:00:00.000Z",
      status: "active" as const,
    };
    expect(completionUndoState(before)).toEqual(before);
  });
});

describe("snoozeUntil", () => {
  it("moves the given number of days forward", () => {
    const from = new Date("2026-06-01T09:00:00.000Z");
    expect(snoozeUntil(7, from).slice(0, 10)).toBe("2026-06-08");
  });
});

describe("projectDefaults", () => {
  it("fills in the fields quick-add leaves out", () => {
    expect(projectDefaults({ name: "Caulk back door" })).toEqual({
      kind: "project",
      name: "Caulk back door",
      category: "admin",
      priority: "soon",
      est_minutes: null,
      location: null,
      materials: null,
      notes: null,
      steps: [],
    });
  });

  it("keeps what the caller supplied", () => {
    const p = projectDefaults({
      name: "Fix outlet",
      est_minutes: 60,
      priority: "next",
      category: "exterior",
      materials: "GFCI",
    });
    expect(p).toMatchObject({
      priority: "next",
      category: "exterior",
      est_minutes: 60,
      materials: "GFCI",
    });
  });
});

describe("validateCadence", () => {
  const recurring: Pick<Task, "kind"> = { kind: "recurring" };

  it("accepts a valid patch", () => {
    expect(
      validateCadence(recurring, {
        base_interval_days: 10,
        seasonal_overrides: [{ months: [4, 5, 6], interval_days: 7 }],
        active_months: [6, 7, 8, 9],
      })
    ).toBeNull();
  });

  it("rejects a cadence on a project", () => {
    expect(validateCadence({ kind: "project" }, { base_interval_days: 7 })).toMatch(
      /Only recurring tasks/
    );
  });

  it("rejects clearing the base interval, which the DB check forbids", () => {
    expect(validateCadence(recurring, { base_interval_days: null })).toMatch(
      /needs a base_interval_days/
    );
  });

  it("rejects out-of-range months", () => {
    expect(
      validateCadence(recurring, {
        seasonal_overrides: [{ months: [0, 13], interval_days: 7 }],
      })
    ).toMatch(/months must be 1–12/);
    expect(validateCadence(recurring, { active_months: [13] })).toMatch(
      /active_months must be 1–12/
    );
  });

  it("rejects an empty month list on an override", () => {
    expect(
      validateCadence(recurring, { seasonal_overrides: [{ months: [], interval_days: 7 }] })
    ).toMatch(/at least one month/);
  });

  it("rejects sub-day intervals", () => {
    expect(validateCadence(recurring, { base_interval_days: 0 })).toMatch(/at least 1/);
  });
});
