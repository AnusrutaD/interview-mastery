import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DAY_MS, istParts } from "../time/ist";
import {
  describeTarget,
  measureTarget,
  periodWindow,
  summariseTarget,
  toTarget,
  type Contribution,
  type Target,
} from "./target";

const NOW = new Date("2026-07-28T04:30:00.000Z"); // Tue 28 Jul, 10:00 IST

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs).toISOString();

describe("periodWindow", () => {
  it("starts the day at IST midnight", () => {
    expect(new Date(periodWindow("daily").start).toISOString()).toBe("2026-07-27T18:30:00.000Z");
  });

  it("starts the week on Monday", () => {
    // 28 Jul 2026 is a Tuesday, so the week begins Monday 27 Jul.
    // Boundaries are read via istParts: an IST midnight is 18:30Z on the
    // *previous* UTC day, so inspecting UTC fields directly reads a day early.
    expect(istParts(periodWindow("weekly").start)).toMatchObject({ month: 6, date: 27 });
  });

  /** Month lengths vary, so the end must come from the calendar, not +30 days. */
  it("ends the month on the first of the next one", () => {
    const { start, end } = periodWindow("monthly");
    expect(istParts(start)).toMatchObject({ year: 2026, month: 6, date: 1 });
    expect(istParts(end)).toMatchObject({ year: 2026, month: 7, date: 1 });
    expect(end - start).not.toBe(30 * DAY_MS);
  });
});

describe("measureTarget — count", () => {
  const target: Target = { period: "daily", unit: "count", value: 3 };

  it("counts contributions inside the window", () => {
    const contributions: Contribution[] = [
      { at: at(0), seconds: 300 },
      { at: at(-60_000), seconds: 300 },
    ];
    expect(measureTarget(target, contributions)).toMatchObject({ done: 2, met: false });
  });

  it("ignores contributions from a previous period", () => {
    const yesterday: Contribution[] = [{ at: at(-2 * DAY_MS), seconds: 600 }];
    expect(measureTarget(target, yesterday).done).toBe(0);
  });

  it("is met once the value is reached", () => {
    const three = Array.from({ length: 3 }, () => ({ at: at(0), seconds: 60 }));
    expect(measureTarget(target, three)).toMatchObject({ done: 3, met: true, remaining: 0 });
  });

  it("caps the percentage when the target is beaten", () => {
    const many = Array.from({ length: 10 }, () => ({ at: at(0), seconds: 60 }));
    expect(measureTarget(target, many).percent).toBe(100);
  });

  it("reports what is still needed", () => {
    expect(measureTarget(target, [{ at: at(0), seconds: 60 }]).remaining).toBe(2);
  });

  it("handles no contributions", () => {
    expect(measureTarget(target, [])).toMatchObject({ done: 0, percent: 0, met: false });
  });

  it("ignores unparseable timestamps rather than throwing", () => {
    expect(measureTarget(target, [{ at: "not a date", seconds: 60 }]).done).toBe(0);
  });
});

describe("measureTarget — minutes", () => {
  const target: Target = { period: "daily", unit: "minutes", value: 30 };

  /**
   * The reason this unit exists: a playlist mixing 5-minute clips with
   * 90-minute lectures makes a count target meaningless.
   */
  it("sums seconds into minutes regardless of item count", () => {
    const contributions: Contribution[] = [
      { at: at(0), seconds: 300 }, // 5 min
      { at: at(0), seconds: 1500 }, // 25 min
    ];
    expect(measureTarget(target, contributions)).toMatchObject({ done: 30, met: true });
  });

  it("floors partial minutes rather than rounding up to a false completion", () => {
    const contributions: Contribution[] = [{ at: at(0), seconds: 1799 }]; // 29.98 min
    expect(measureTarget(target, contributions)).toMatchObject({ done: 29, met: false });
  });

  it("counts one long item toward the whole target", () => {
    expect(measureTarget(target, [{ at: at(0), seconds: 3600 }]).met).toBe(true);
  });
});

describe("window boundaries", () => {
  const target: Target = { period: "daily", unit: "count", value: 1 };

  it("includes the start instant", () => {
    const { start } = periodWindow("daily");
    expect(measureTarget(target, [{ at: start, seconds: 0 }]).done).toBe(1);
  });

  it("excludes the end instant, so it belongs to the next period", () => {
    const { end } = periodWindow("daily");
    expect(measureTarget(target, [{ at: end, seconds: 0 }]).done).toBe(0);
  });
});

describe("toTarget", () => {
  /**
   * Null means the user opted out of pacing this list. Returning a zero-valued
   * target instead would render as "met", which is exactly wrong.
   */
  it("is null when there is no value", () => {
    expect(toTarget({ value: null })).toBeNull();
    expect(toTarget({ value: 0 })).toBeNull();
    expect(toTarget({})).toBeNull();
  });

  it("defaults an unknown period and unit to daily count", () => {
    expect(toTarget({ value: 5, period: "fortnightly", unit: "hours" })).toEqual({
      period: "daily",
      unit: "count",
      value: 5,
    });
  });

  it("keeps recognised values", () => {
    expect(toTarget({ value: 45, period: "weekly", unit: "minutes" })).toEqual({
      period: "weekly",
      unit: "minutes",
      value: 45,
    });
  });
});

describe("summariseTarget", () => {
  it("renders a count target compactly", () => {
    expect(summariseTarget({ period: "daily", unit: "count", value: 3 })).toBe("3/day");
  });

  it("keeps the unit visible for minutes so 30 is not read as 30 items", () => {
    expect(summariseTarget({ period: "weekly", unit: "minutes", value: 30 })).toBe("30 min/week");
  });

  it("covers every period", () => {
    expect(summariseTarget({ period: "monthly", unit: "count", value: 40 })).toBe("40/month");
  });
});

describe("describeTarget", () => {
  it("labels a count target", () => {
    const progress = measureTarget({ period: "daily", unit: "count", value: 3 }, []);
    expect(describeTarget(progress)).toBe("0 / 3 today");
  });

  it("labels a minutes target with its unit and period", () => {
    const progress = measureTarget({ period: "weekly", unit: "minutes", value: 120 }, []);
    expect(describeTarget(progress)).toBe("0 / 120 min this week");
  });
});
