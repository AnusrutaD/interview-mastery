import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { describeRevisionProgress, measureRevisionTarget, toRevisionContributions } from "./revision";
import type { Target } from "./target";

// 10:00 IST on a Tuesday — inside the same IST day, week and month.
const NOW = new Date("2026-07-28T04:30:00.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

const weekly = (value: number): Target => ({ period: "weekly", unit: "count", value });

describe("toRevisionContributions", () => {
  it("ignores items that have never been revised", () => {
    expect(toRevisionContributions([{ lastRevisedAt: null }, { lastRevisedAt: null }])).toEqual([]);
  });

  /** Revisions are counted, never timed, so a duration would be fictional. */
  it("carries no duration", () => {
    const [contribution] = toRevisionContributions([{ lastRevisedAt: NOW.toISOString() }]);
    expect(contribution.seconds).toBe(0);
  });
});

describe("measureRevisionTarget", () => {
  it("counts items revised inside the period", () => {
    const progress = measureRevisionTarget(weekly(3), [
      { lastRevisedAt: NOW.toISOString() },
      { lastRevisedAt: NOW.toISOString() },
    ]);
    expect(progress.done).toBe(2);
    expect(progress.met).toBe(false);
    expect(progress.remaining).toBe(1);
  });

  it("excludes revisions from before the period", () => {
    const progress = measureRevisionTarget(weekly(2), [
      { lastRevisedAt: "2026-07-01T10:00:00.000Z" },
      { lastRevisedAt: NOW.toISOString() },
    ]);
    expect(progress.done).toBe(1);
  });

  it("reports a met target", () => {
    const progress = measureRevisionTarget(weekly(1), [{ lastRevisedAt: NOW.toISOString() }]);
    expect(progress.met).toBe(true);
    expect(progress.remaining).toBe(0);
  });

  /**
   * The documented consequence of storing a timestamp rather than an event log:
   * only the latest revision per item survives, so a target measures breadth of
   * coverage rather than raw activity.
   */
  it("counts each item once, since only its latest revision is stored", () => {
    const progress = measureRevisionTarget(weekly(5), [{ lastRevisedAt: NOW.toISOString() }]);
    expect(progress.done).toBe(1);
  });

  /**
   * A minutes unit would silently measure zero, because revisions carry no
   * duration. Forcing count is what stops a target from being unsatisfiable.
   */
  it("ignores a minutes unit rather than measuring zero", () => {
    const progress = measureRevisionTarget(
      { period: "weekly", unit: "minutes", value: 2 },
      [{ lastRevisedAt: NOW.toISOString() }, { lastRevisedAt: NOW.toISOString() }]
    );
    expect(progress.done).toBe(2);
    expect(progress.met).toBe(true);
  });
});

describe("describeRevisionProgress", () => {
  it("names the period", () => {
    expect(describeRevisionProgress(measureRevisionTarget(weekly(5), []))).toBe(
      "0 / 5 revised this week"
    );
  });

  it("distinguishes daily and monthly", () => {
    expect(
      describeRevisionProgress(
        measureRevisionTarget({ period: "daily", unit: "count", value: 2 }, [])
      )
    ).toBe("0 / 2 revised today");
    expect(
      describeRevisionProgress(
        measureRevisionTarget({ period: "monthly", unit: "count", value: 9 }, [])
      )
    ).toBe("0 / 9 revised this month");
  });
});
