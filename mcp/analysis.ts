/**
 * Cadence tuning: what the completion history says about whether an interval
 * is set right.
 *
 * PRD §5 keeps `completions` as a separate table specifically so intervals can
 * be tuned "against what actually happened" — but the app has no screen for
 * that. This is the analysis behind the `completion_history` tool, and the one
 * thing the MCP server does that the app can't.
 *
 * Pure functions, no I/O, so they're testable without a database.
 */

export interface IntervalStats {
  completions: number;
  /** Days between consecutive completions, oldest pair first. */
  gaps: number[];
  medianGap: number | null;
  meanGap: number | null;
  minGap: number | null;
  maxGap: number | null;
  nominalIntervalDays: number | null;
  /** medianGap − nominal. Positive means it takes longer than the cadence claims. */
  driftDays: number | null;
  suggestedIntervalDays: number | null;
  verdict: string;
}

const DAY_MS = 86_400_000;
const round1 = (n: number) => Math.round(n * 10) / 10;

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * @param completedAt ISO timestamps in any order; sorted internally.
 * @param nominalIntervalDays the task's configured cadence, null for projects.
 */
export function analyzeIntervals(
  completedAt: string[],
  nominalIntervalDays: number | null
): IntervalStats {
  const times = completedAt
    .map((s) => new Date(s).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);

  const gaps: number[] = [];
  for (let i = 1; i < times.length; i++) {
    gaps.push(round1((times[i] - times[i - 1]) / DAY_MS));
  }

  const med = median(gaps);
  const mean = gaps.length
    ? round1(gaps.reduce((a, b) => a + b, 0) / gaps.length)
    : null;
  const drift =
    med != null && nominalIntervalDays != null
      ? round1(med - nominalIntervalDays)
      : null;

  // Only propose a change when there's enough history to mean something and
  // the drift is bigger than the rounding noise of a day either way.
  const suggested =
    med != null && drift != null && gaps.length >= 3 && Math.abs(drift) > 1
      ? Math.max(1, Math.round(med))
      : null;

  return {
    completions: times.length,
    gaps,
    medianGap: med,
    meanGap: mean,
    minGap: gaps.length ? Math.min(...gaps) : null,
    maxGap: gaps.length ? Math.max(...gaps) : null,
    nominalIntervalDays,
    driftDays: drift,
    suggestedIntervalDays: suggested,
    verdict: verdictFor(gaps, med, drift, suggested, nominalIntervalDays),
  };
}

function verdictFor(
  gaps: number[],
  med: number | null,
  drift: number | null,
  suggested: number | null,
  nominal: number | null
): string {
  if (gaps.length === 0) {
    return "Not enough history — two completions are needed before an interval can be measured.";
  }
  if (nominal == null) {
    return "No cadence set (project or interval-less task), so there's nothing to compare against.";
  }
  if (drift == null || med == null) return "No usable history.";

  const spread = Math.max(...gaps) - Math.min(...gaps);
  const noisy = spread > Math.max(nominal, 7);
  const caveat = noisy
    ? ` Gaps are inconsistent (${Math.min(...gaps)}–${Math.max(...gaps)}d), so treat the median loosely.`
    : "";

  if (gaps.length < 3) {
    return `Only ${gaps.length} interval${gaps.length === 1 ? "" : "s"} recorded (median ${med}d vs ${nominal}d nominal) — too little to retune on.${caveat}`;
  }
  if (suggested == null) {
    return `Median ${med}d against a ${nominal}d cadence — close enough, leave it alone.${caveat}`;
  }
  return drift > 0
    ? `Running ${drift}d longer than the ${nominal}d cadence (median ${med}d). The cadence is stricter than real life; ${suggested}d would match what actually happens.${caveat}`
    : `Running ${Math.abs(drift)}d shorter than the ${nominal}d cadence (median ${med}d). It's being done more often than asked; ${suggested}d would reflect that.${caveat}`;
}
