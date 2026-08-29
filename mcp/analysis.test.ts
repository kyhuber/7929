import { describe, expect, it } from "vitest";
import { analyzeIntervals, median } from "./analysis";

/** n days before a fixed reference date, as an ISO string. */
const ref = new Date("2026-06-01T12:00:00.000Z").getTime();
const daysAgo = (n: number) => new Date(ref - n * 86_400_000).toISOString();

describe("median", () => {
  it("returns null for an empty list", () => {
    expect(median([])).toBeNull();
  });

  it("averages the middle pair for an even count", () => {
    expect(median([4, 10, 6, 8])).toBe(7);
  });

  it("takes the middle value for an odd count", () => {
    expect(median([9, 1, 5])).toBe(5);
  });
});

describe("analyzeIntervals", () => {
  it("reports no usable history for a single completion", () => {
    const stats = analyzeIntervals([daysAgo(3)], 7);
    expect(stats.completions).toBe(1);
    expect(stats.gaps).toEqual([]);
    expect(stats.medianGap).toBeNull();
    expect(stats.suggestedIntervalDays).toBeNull();
    expect(stats.verdict).toMatch(/Not enough history/);
  });

  it("measures gaps regardless of input order", () => {
    const stats = analyzeIntervals([daysAgo(0), daysAgo(20), daysAgo(10)], 10);
    expect(stats.gaps).toEqual([10, 10]);
    expect(stats.medianGap).toBe(10);
    expect(stats.driftDays).toBe(0);
  });

  it("holds off on a suggestion until three intervals exist", () => {
    // Two 14-day gaps against a 7-day cadence: clear drift, thin evidence.
    const stats = analyzeIntervals([daysAgo(28), daysAgo(14), daysAgo(0)], 7);
    expect(stats.driftDays).toBe(7);
    expect(stats.suggestedIntervalDays).toBeNull();
    expect(stats.verdict).toMatch(/too little to retune/);
  });

  it("suggests loosening a cadence that reality runs longer than", () => {
    const stats = analyzeIntervals(
      [daysAgo(40), daysAgo(30), daysAgo(20), daysAgo(10), daysAgo(0)],
      7
    );
    expect(stats.gaps).toEqual([10, 10, 10, 10]);
    expect(stats.driftDays).toBe(3);
    expect(stats.suggestedIntervalDays).toBe(10);
    expect(stats.verdict).toMatch(/Running 3d longer/);
  });

  it("suggests tightening a cadence that is beaten consistently", () => {
    const stats = analyzeIntervals(
      [daysAgo(20), daysAgo(15), daysAgo(10), daysAgo(5), daysAgo(0)],
      14
    );
    expect(stats.driftDays).toBe(-9);
    expect(stats.suggestedIntervalDays).toBe(5);
    expect(stats.verdict).toMatch(/Running 9d shorter/);
  });

  it("leaves a cadence alone when drift is within a day", () => {
    const stats = analyzeIntervals(
      [daysAgo(28), daysAgo(21), daysAgo(14), daysAgo(7), daysAgo(0)],
      7
    );
    expect(stats.driftDays).toBe(0);
    expect(stats.suggestedIntervalDays).toBeNull();
    expect(stats.verdict).toMatch(/leave it alone/);
  });

  it("flags inconsistent gaps so the median isn't over-trusted", () => {
    const stats = analyzeIntervals(
      [daysAgo(60), daysAgo(58), daysAgo(20), daysAgo(18), daysAgo(0)],
      7
    );
    expect(stats.verdict).toMatch(/inconsistent/);
  });

  it("has nothing to compare against without a cadence", () => {
    const stats = analyzeIntervals([daysAgo(10), daysAgo(0)], null);
    expect(stats.driftDays).toBeNull();
    expect(stats.verdict).toMatch(/No cadence set/);
  });

  it("ignores unparseable timestamps", () => {
    const stats = analyzeIntervals(["not-a-date", daysAgo(10), daysAgo(0)], 10);
    expect(stats.completions).toBe(2);
    expect(stats.gaps).toEqual([10]);
  });
});
