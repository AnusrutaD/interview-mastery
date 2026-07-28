import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { daysUntilReview, isDue, REVIEW_INTERVAL_DAYS, reviewLabel } from "./review";

/**
 * All cases are anchored to a fixed "now" in IST so they are stable regardless
 * of where CI runs. 2026-07-28T04:30:00Z is exactly 10:00 IST on 28 July.
 */
const NOW = new Date("2026-07-28T04:30:00.000Z");

/** Build a UTC instant for a given IST wall-clock time. */
function ist(day: number, hour: number, minute = 0): string {
  const utcHour = hour - 5;
  const utcMinute = minute - 30;
  return new Date(Date.UTC(2026, 6, day, utcHour, utcMinute)).toISOString();
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("isDue", () => {
  it("never marks unseen problems as due", () => {
    expect(isDue("unseen", ist(1, 10))).toBe(false);
  });

  it("returns false when there is no practice timestamp", () => {
    expect(isDue("learning", null)).toBe(false);
  });

  it("is not due on the same calendar day", () => {
    expect(isDue("learning", ist(28, 9))).toBe(false);
  });

  /**
   * Regression: comparing raw milliseconds meant a problem solved at 22:00
   * yesterday was "only 11 hours old" at 09:00 today and never became due.
   * Scheduling must count calendar days, not elapsed hours.
   */
  it("is due the next calendar day even if under 24 hours elapsed", () => {
    expect(isDue("learning", ist(27, 22))).toBe(true);
  });

  it("respects the familiar interval of 3 days", () => {
    expect(isDue("familiar", ist(26, 10))).toBe(false); // 2 days ago
    expect(isDue("familiar", ist(25, 10))).toBe(true); // 3 days ago
  });

  it("respects the mastered interval of 7 days", () => {
    expect(isDue("mastered", ist(22, 10))).toBe(false); // 6 days
    expect(isDue("mastered", ist(21, 10))).toBe(true); // 7 days
  });

  it("treats long-overdue problems as due", () => {
    expect(isDue("mastered", ist(1, 10))).toBe(true);
  });
});

describe("daysUntilReview", () => {
  it("is null for unscheduled problems", () => {
    expect(daysUntilReview("unseen", ist(27, 10))).toBeNull();
    expect(daysUntilReview("learning", null)).toBeNull();
  });

  it("counts down from the interval", () => {
    expect(daysUntilReview("familiar", ist(28, 10))).toBe(3);
    expect(daysUntilReview("familiar", ist(27, 10))).toBe(2);
  });

  it("goes negative once overdue", () => {
    expect(daysUntilReview("learning", ist(25, 10))).toBe(-2);
  });
});

describe("reviewLabel", () => {
  it.each([
    ["learning", ist(28, 10), "Due tomorrow"],
    ["learning", ist(27, 10), "Due for review"],
    ["learning", ist(25, 10), "Overdue by 2d"],
    ["mastered", ist(28, 10), "Due in 7d"],
  ] as const)("%s → %s", (level, timestamp, expected) => {
    expect(reviewLabel(level, timestamp)).toBe(expected);
  });

  it("returns null when unscheduled", () => {
    expect(reviewLabel("unseen", ist(27, 10))).toBeNull();
  });
});

describe("intervals", () => {
  it("increase with mastery", () => {
    expect(REVIEW_INTERVAL_DAYS.learning).toBeLessThan(REVIEW_INTERVAL_DAYS.familiar);
    expect(REVIEW_INTERVAL_DAYS.familiar).toBeLessThan(REVIEW_INTERVAL_DAYS.mastered);
  });
});
