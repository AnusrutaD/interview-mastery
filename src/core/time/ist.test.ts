import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DAY_MS,
  isISTToday,
  istDayKey,
  istDaysBetween,
  istDayStart,
  istMonthStart,
  istNextMonthStart,
  istParts,
  istWeekStart,
} from "./ist";

/** 2026-07-28T04:30:00Z === 2026-07-28 10:00 IST (a Tuesday). */
const NOW = new Date("2026-07-28T04:30:00.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("istParts", () => {
  it("reads IST wall-clock components", () => {
    expect(istParts(NOW)).toEqual({ year: 2026, month: 6, date: 28, weekday: 2 });
  });

  /**
   * The window between 18:30 UTC and midnight UTC is already the next day in
   * IST. Getting this wrong is what made the daily goal complete too early.
   */
  it("rolls to the next IST day after 18:30 UTC", () => {
    expect(istParts("2026-07-28T18:31:00.000Z").date).toBe(29);
  });

  it("stays on the same IST day just before 18:30 UTC", () => {
    expect(istParts("2026-07-28T18:29:00.000Z").date).toBe(28);
  });

  it("handles the year boundary", () => {
    // 31 Dec 2026 19:00 UTC is 1 Jan 2027 00:30 IST.
    expect(istParts("2026-12-31T19:00:00.000Z")).toMatchObject({
      year: 2027,
      month: 0,
      date: 1,
    });
  });
});

describe("istDayStart", () => {
  it("is 18:30 UTC on the previous day", () => {
    expect(new Date(istDayStart(NOW)).toISOString()).toBe("2026-07-27T18:30:00.000Z");
  });

  it("is stable across any instant within the same IST day", () => {
    const morning = istDayStart("2026-07-27T18:30:00.000Z");
    const night = istDayStart("2026-07-28T18:29:59.000Z");
    expect(morning).toBe(night);
  });
});

describe("istWeekStart", () => {
  it("returns Monday for a midweek date", () => {
    // 28 Jul 2026 is a Tuesday, so the week starts Monday 27 Jul.
    expect(istParts(istWeekStart(NOW) + 1000).date).toBe(27);
  });

  it("treats Sunday as the end of the week, not the start", () => {
    // Sunday 2 Aug 2026 belongs to the week beginning Monday 27 Jul.
    const sunday = "2026-08-02T06:00:00.000Z";
    expect(istParts(istWeekStart(sunday) + 1000).date).toBe(27);
  });
});

describe("month helpers", () => {
  it("finds the first of the current IST month", () => {
    expect(istParts(istMonthStart(NOW) + 1000)).toMatchObject({ month: 6, date: 1 });
  });

  it("finds the first of the next month", () => {
    expect(istParts(istNextMonthStart(NOW) + 1000)).toMatchObject({ month: 7, date: 1 });
  });

  it("wraps December into the following January", () => {
    const december = "2026-12-15T06:00:00.000Z";
    expect(istParts(istNextMonthStart(december) + 1000)).toMatchObject({
      year: 2027,
      month: 0,
      date: 1,
    });
  });
});

describe("istDaysBetween", () => {
  it("is zero within the same IST day", () => {
    expect(istDaysBetween("2026-07-28T05:00:00.000Z", NOW)).toBe(0);
  });

  // The core of the spaced-repetition fix.
  it("counts one calendar day even when under 24 hours apart", () => {
    // 27 Jul 22:00 IST → 28 Jul 10:00 IST is 12 hours but one calendar day.
    expect(istDaysBetween("2026-07-27T16:30:00.000Z", NOW)).toBe(1);
  });

  it("counts multiple days", () => {
    expect(istDaysBetween(NOW.getTime() - 5 * DAY_MS, NOW)).toBe(5);
  });
});

describe("istDayKey", () => {
  it("produces a stable zero-padded key", () => {
    expect(istDayKey(NOW)).toBe("2026-07-28");
  });

  it("gives the same key for two instants on one IST day", () => {
    expect(istDayKey("2026-07-27T18:30:00.000Z")).toBe(istDayKey("2026-07-28T18:29:00.000Z"));
  });

  it("distinguishes adjacent days", () => {
    expect(istDayKey("2026-07-28T18:29:00.000Z")).not.toBe(
      istDayKey("2026-07-28T18:31:00.000Z")
    );
  });
});

describe("isISTToday", () => {
  it("recognises today", () => {
    expect(isISTToday(NOW)).toBe(true);
  });

  it("rejects yesterday even if only hours ago", () => {
    expect(isISTToday("2026-07-27T16:00:00.000Z")).toBe(false);
  });
});
