import { describe, expect, it } from "vitest";
import {
  bucketFor,
  classifyForToday,
  dueInfo,
  effectiveIntervalDays,
  formatCadence,
  formatMonths,
  isActiveInMonth,
  nextUpcoming,
} from "./dueness";
import type { Task } from "./types";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1",
    kind: "recurring",
    name: "Test task",
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
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

// local-time date helper
const d = (y: number, m: number, day: number, h = 12) =>
  new Date(y, m - 1, day, h);

describe("effectiveIntervalDays", () => {
  const mow = makeTask({
    base_interval_days: 30,
    seasonal_overrides: [{ months: [4, 5, 6, 7, 8, 9], interval_days: 10 }],
  });

  it("uses the seasonal override inside its months", () => {
    expect(effectiveIntervalDays(mow, d(2026, 7, 15))).toBe(10);
    expect(effectiveIntervalDays(mow, d(2026, 4, 1))).toBe(10);
    expect(effectiveIntervalDays(mow, d(2026, 9, 30))).toBe(10);
  });

  it("falls back to base outside override months", () => {
    expect(effectiveIntervalDays(mow, d(2026, 3, 31))).toBe(30);
    expect(effectiveIntervalDays(mow, d(2026, 10, 1))).toBe(30);
    expect(effectiveIntervalDays(mow, d(2026, 12, 25))).toBe(30);
  });

  it("returns null when a project has no interval", () => {
    expect(
      effectiveIntervalDays(
        makeTask({ kind: "project", base_interval_days: null }),
        d(2026, 7, 15)
      )
    ).toBeNull();
  });
});

describe("isActiveInMonth", () => {
  const water = makeTask({ active_months: [6, 7, 8, 9] });

  it("is active inside its months and inactive outside", () => {
    expect(isActiveInMonth(water, d(2026, 7, 1))).toBe(true);
    expect(isActiveInMonth(water, d(2026, 5, 31))).toBe(false);
    expect(isActiveInMonth(water, d(2026, 10, 1))).toBe(false);
  });

  it("null active_months means year-round", () => {
    expect(isActiveInMonth(makeTask(), d(2026, 1, 1))).toBe(true);
  });
});

describe("dueInfo", () => {
  it("treats a never-completed task as due today", () => {
    const info = dueInfo(makeTask(), d(2026, 7, 23));
    expect(info?.daysOverdue).toBe(0);
  });

  it("computes days overdue from last completion + interval", () => {
    // completed 10 days ago on a 7-day interval → 3 days overdue
    const info = dueInfo(
      makeTask({ last_completed_at: d(2026, 7, 13, 20).toISOString() }),
      d(2026, 7, 23, 8)
    );
    expect(info?.daysOverdue).toBe(3);
  });

  it("flips at midnight regardless of completion time of day", () => {
    // completed late on the 16th, 7-day interval → due on the 23rd,
    // even when the app is opened early morning
    const info = dueInfo(
      makeTask({ last_completed_at: d(2026, 7, 16, 23).toISOString() }),
      d(2026, 7, 23, 6)
    );
    expect(info?.daysOverdue).toBe(0);
  });

  it("returns null for projects", () => {
    expect(dueInfo(makeTask({ kind: "project" }), d(2026, 7, 23))).toBeNull();
  });

  it("returns null outside active months", () => {
    const water = makeTask({
      active_months: [6, 7, 8, 9],
      base_interval_days: 4,
    });
    expect(dueInfo(water, d(2026, 10, 5))).toBeNull();
    expect(dueInfo(water, d(2026, 7, 5))).not.toBeNull();
  });

  it("uses the seasonal interval for the current month", () => {
    const mow = makeTask({
      base_interval_days: 30,
      seasonal_overrides: [{ months: [4, 5, 6, 7, 8, 9], interval_days: 10 }],
      last_completed_at: d(2026, 7, 11).toISOString(),
    });
    // 12 days since completion, July interval is 10 → 2 days overdue
    expect(dueInfo(mow, d(2026, 7, 23))?.daysOverdue).toBe(2);
  });
});

describe("bucketFor", () => {
  it("maps the PRD table", () => {
    expect(bucketFor(5)).toBe("overdue");
    expect(bucketFor(1)).toBe("overdue");
    expect(bucketFor(0)).toBe("due");
    expect(bucketFor(-1)).toBe("upcoming");
    expect(bucketFor(-3)).toBe("upcoming");
    expect(bucketFor(-4)).toBe("scheduled");
    expect(bucketFor(-40)).toBe("scheduled");
  });
});

describe("classifyForToday", () => {
  const now = d(2026, 7, 23);
  const daysAgo = (n: number) => d(2026, 7, 23 - n).toISOString();

  it("sorts most-overdue first and suppresses snoozed/archived", () => {
    const tasks = [
      makeTask({ id: "a", last_completed_at: daysAgo(8) }), // 1 overdue
      makeTask({ id: "b", last_completed_at: daysAgo(12) }), // 5 overdue
      makeTask({ id: "c", last_completed_at: daysAgo(7) }), // due today
      makeTask({
        id: "snoozed",
        last_completed_at: daysAgo(12),
        snooze_until: d(2026, 7, 25).toISOString(),
      }),
      makeTask({
        id: "archived",
        last_completed_at: daysAgo(12),
        status: "archived",
      }),
      makeTask({ id: "proj", kind: "project", base_interval_days: null }),
    ];
    const items = classifyForToday(tasks, now);
    expect(items.map((i) => i.task.id)).toEqual(["b", "a", "c"]);
    expect(items.map((i) => i.bucket)).toEqual(["overdue", "overdue", "due"]);
  });

  it("expired snooze no longer suppresses", () => {
    const items = classifyForToday(
      [
        makeTask({
          last_completed_at: daysAgo(9),
          snooze_until: d(2026, 7, 22).toISOString(),
        }),
      ],
      now
    );
    expect(items).toHaveLength(1);
    expect(items[0].due.daysOverdue).toBe(2);
  });

  it("nextUpcoming finds the nearest future task", () => {
    const tasks = [
      makeTask({ id: "soon", last_completed_at: daysAgo(5) }), // due in 2
      makeTask({ id: "later", last_completed_at: daysAgo(1) }), // due in 6
    ];
    expect(nextUpcoming(tasks, now)?.task.id).toBe("soon");
  });
});

describe("formatting", () => {
  it("compresses month ranges", () => {
    expect(formatMonths([4, 5, 6, 7, 8, 9])).toBe("Apr–Sep");
    expect(formatMonths([2, 9])).toBe("Feb, Sep");
    expect(formatMonths([11, 12, 1])).toBe("Jan, Nov–Dec");
  });

  it("formats cadence lines", () => {
    expect(
      formatCadence(
        makeTask({
          base_interval_days: 30,
          seasonal_overrides: [
            { months: [4, 5, 6, 7, 8, 9], interval_days: 10 },
          ],
        })
      )
    ).toBe("every 30d · 10d Apr–Sep");

    expect(
      formatCadence(
        makeTask({ base_interval_days: 4, active_months: [6, 7, 8, 9] })
      )
    ).toBe("every 4d · Jun–Sep only");
  });
});
