import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  daysUntilReview,
  isDue,
  isDueNow,
  isFlaggedForReview,
  REVIEW_INTERVAL_DAYS,
  reviewAnchor,
  reviewLabel,
} from "./review";

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

describe("reviewAnchor", () => {
  it("uses whichever of practice and revision is later", () => {
    const anchor = reviewAnchor({
      mastery: "familiar",
      lastPracticedAt: "2026-07-20T10:00:00.000Z",
      lastRevisedAt: "2026-07-26T10:00:00.000Z",
    });
    expect(new Date(anchor as Date).toISOString()).toBe("2026-07-26T10:00:00.000Z");
  });

  it("falls back to either one alone", () => {
    expect(
      new Date(
        reviewAnchor({ mastery: "familiar", lastPracticedAt: null, lastRevisedAt: "2026-07-26T10:00:00.000Z" }) as Date
      ).toISOString()
    ).toBe("2026-07-26T10:00:00.000Z");
    expect(
      new Date(
        reviewAnchor({ mastery: "familiar", lastPracticedAt: "2026-07-20T10:00:00.000Z" }) as Date
      ).toISOString()
    ).toBe("2026-07-20T10:00:00.000Z");
  });

  it("is null when the item has never been touched", () => {
    expect(reviewAnchor({ mastery: "unseen", lastPracticedAt: null })).toBeNull();
  });
});

describe("isDueNow", () => {
  /** The whole point of the feature: reading your notes clears the due state. */
  it("clears a due item when it was revised today", () => {
    const state = {
      mastery: "familiar" as const,
      lastPracticedAt: "2026-07-01T10:00:00.000Z",
      lastRevisedAt: NOW.toISOString(),
    };
    expect(isDue(state.mastery, state.lastPracticedAt)).toBe(true);
    expect(isDueNow(state)).toBe(false);
  });

  it("still comes due again once the interval elapses after a revision", () => {
    expect(
      isDueNow({
        mastery: "learning",
        lastPracticedAt: "2026-07-01T10:00:00.000Z",
        lastRevisedAt: "2026-07-26T10:00:00.000Z",
      })
    ).toBe(true);
  });

  it("forces an item due when the user flags it", () => {
    const state = {
      mastery: "mastered" as const,
      lastPracticedAt: NOW.toISOString(),
      flaggedForReviewAt: NOW.toISOString(),
    };
    expect(isDue(state.mastery, state.lastPracticedAt)).toBe(false);
    expect(isDueNow(state)).toBe(true);
  });

  /**
   * The tie case, and the one that matters most in practice: flagging a problem
   * you solved earlier the same day. Under a strict `>` comparison the flag
   * loses to an equal anchor and the item stays not-due, which defeats the
   * feature entirely.
   */
  it("honours a flag set at the same instant as the last practice", () => {
    const at = NOW.toISOString();
    expect(isDueNow({ mastery: "mastered", lastPracticedAt: at, flaggedForReviewAt: at })).toBe(
      true
    );
    expect(
      isFlaggedForReview({ mastery: "mastered", lastPracticedAt: at, flaggedForReviewAt: at })
    ).toBe(true);
  });

  /**
   * A flag that outlived its review would pin the item as due forever and make
   * revising it look broken.
   */
  it("lets a later revision clear an earlier flag", () => {
    expect(
      isDueNow({
        mastery: "mastered",
        lastPracticedAt: "2026-07-01T10:00:00.000Z",
        flaggedForReviewAt: "2026-07-20T10:00:00.000Z",
        lastRevisedAt: NOW.toISOString(),
      })
    ).toBe(false);
  });

  it("flags an unseen item due even with no history", () => {
    expect(
      isDueNow({ mastery: "unseen", lastPracticedAt: null, flaggedForReviewAt: NOW.toISOString() })
    ).toBe(true);
  });

  it("matches isDue when there is no revision or flag", () => {
    for (const at of [null, "2026-07-01T10:00:00.000Z", NOW.toISOString()]) {
      for (const mastery of ["unseen", "unsolved", "learning", "familiar", "mastered"] as const) {
        expect(isDueNow({ mastery, lastPracticedAt: at })).toBe(isDue(mastery, at));
      }
    }
  });
});

describe("isFlaggedForReview", () => {
  it("is true while the flag is newer than the last review", () => {
    expect(
      isFlaggedForReview({
        mastery: "mastered",
        lastPracticedAt: "2026-07-01T10:00:00.000Z",
        flaggedForReviewAt: NOW.toISOString(),
      })
    ).toBe(true);
  });

  it("is false once the item has been revised since", () => {
    expect(
      isFlaggedForReview({
        mastery: "mastered",
        lastPracticedAt: "2026-07-01T10:00:00.000Z",
        flaggedForReviewAt: "2026-07-20T10:00:00.000Z",
        lastRevisedAt: NOW.toISOString(),
      })
    ).toBe(false);
  });

  it("is false when nothing was ever flagged", () => {
    expect(isFlaggedForReview({ mastery: "familiar", lastPracticedAt: NOW.toISOString() })).toBe(
      false
    );
  });
});
