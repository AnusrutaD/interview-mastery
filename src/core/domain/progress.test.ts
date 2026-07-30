import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DAY_MS } from "../time/ist";
import {
  calculateStreak,
  EMPTY_PROGRESS,
  filterByPeriod,
  joinProgress,
  summarize,
  suggestNext,
  type Problem,
  type ProgressMap,
} from "./progress";

const NOW = new Date("2026-07-28T04:30:00.000Z"); // 10:00 IST, Tue 28 Jul

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

const problems: Problem[] = [
  { id: 1, title: "Two Sum", difficulty: "Easy", category: "Arrays", leetcode: "1", url: "u1" },
  { id: 2, title: "3Sum", difficulty: "Medium", category: "Arrays", leetcode: "15", url: "u2" },
  { id: 3, title: "N-Queens", difficulty: "Hard", category: "Backtracking", leetcode: "51", url: "u3" },
];

function record(over: Partial<(typeof EMPTY_PROGRESS)> = {}) {
  return { ...EMPTY_PROGRESS, ...over };
}

describe("joinProgress", () => {
  it("fills unrecorded problems with the empty record", () => {
    const joined = joinProgress(problems, {});
    expect(joined).toHaveLength(3);
    expect(joined[0]).toMatchObject({ id: 1, mastery: "unseen", due: false });
  });

  it("computes due state from lastMasteryAt", () => {
    const progress: ProgressMap = {
      1: record({ mastery: "learning", lastMasteryAt: "2026-07-26T10:00:00.000Z" }),
    };
    expect(joinProgress(problems, progress)[0].due).toBe(true);
  });

  /**
   * Regression: scheduling previously keyed off Prisma's `updatedAt`, which is
   * bumped by any write. Saving a note therefore reset the review schedule.
   * A stale `updatedAt` must not make a freshly practised problem due.
   */
  it("ignores updatedAt when deciding due state", () => {
    const progress: ProgressMap = {
      1: record({
        mastery: "learning",
        lastMasteryAt: NOW.toISOString(), // practised today
        updatedAt: "2026-01-01T00:00:00.000Z", // ancient
      }),
    };
    expect(joinProgress(problems, progress)[0].due).toBe(false);
  });
});

describe("summarize", () => {
  it("reports zeroes for untouched data", () => {
    const stats = summarize(joinProgress(problems, {}));
    expect(stats).toMatchObject({
      total: 3,
      attempted: 0,
      due: 0,
      solvedToday: 0,
      completionPercent: 0,
    });
    expect(stats.byMastery.unseen).toBe(3);
  });

  it("counts attempts, difficulty splits and time", () => {
    const progress: ProgressMap = {
      1: record({ mastery: "mastered", totalTimeSeconds: 300 }),
      2: record({ mastery: "learning", totalTimeSeconds: 120 }),
    };
    const stats = summarize(joinProgress(problems, progress));
    expect(stats.attempted).toBe(2);
    expect(stats.completionPercent).toBe(67);
    expect(stats.totalTimeSeconds).toBe(420);
    expect(stats.byDifficulty.Easy).toEqual({ total: 1, attempted: 1 });
    expect(stats.byDifficulty.Hard).toEqual({ total: 1, attempted: 0 });
  });

  it("counts solvedToday by IST day, not a rolling 24 hours", () => {
    const progress: ProgressMap = {
      1: record({ mastery: "learning", lastMasteryAt: "2026-07-27T19:00:00.000Z" }), // 00:30 IST today
      2: record({ mastery: "learning", lastMasteryAt: "2026-07-27T16:00:00.000Z" }), // 21:30 IST yesterday
    };
    expect(summarize(joinProgress(problems, progress)).solvedToday).toBe(1);
  });

  it("does not count unseen problems as solved today", () => {
    const progress: ProgressMap = {
      1: record({ mastery: "unseen", lastMasteryAt: NOW.toISOString() }),
    };
    expect(summarize(joinProgress(problems, progress)).solvedToday).toBe(0);
  });
});

describe("calculateStreak", () => {
  const day = (offset: number) => new Date(NOW.getTime() - offset * DAY_MS).toISOString();

  it("is zero with no practice", () => {
    expect(calculateStreak([])).toBe(0);
  });

  it("counts consecutive days ending today", () => {
    expect(calculateStreak([day(0), day(1), day(2)])).toBe(3);
  });

  it("survives a day with nothing yet, counting back from yesterday", () => {
    expect(calculateStreak([day(1), day(2)])).toBe(2);
  });

  it("breaks once two days are missed", () => {
    expect(calculateStreak([day(2), day(3)])).toBe(0);
  });

  it("stops at the first gap", () => {
    expect(calculateStreak([day(0), day(1), day(3)])).toBe(2);
  });

  it("counts multiple solves on one day once", () => {
    expect(calculateStreak([day(0), day(0), day(0)])).toBe(1);
  });
});

describe("filterByPeriod", () => {
  it("includes the start bound and excludes the end bound", () => {
    const start = Date.parse("2026-07-27T00:00:00.000Z");
    const end = Date.parse("2026-07-28T00:00:00.000Z");
    const progress: ProgressMap = {
      1: record({ mastery: "learning", lastMasteryAt: new Date(start).toISOString() }),
      2: record({ mastery: "learning", lastMasteryAt: new Date(end).toISOString() }),
    };
    const result = filterByPeriod(joinProgress(problems, progress), start, end);
    expect(result.map((p) => p.id)).toEqual([1]);
  });

  it("sorts newest first", () => {
    const progress: ProgressMap = {
      1: record({ mastery: "learning", lastMasteryAt: "2026-07-27T01:00:00.000Z" }),
      2: record({ mastery: "learning", lastMasteryAt: "2026-07-27T05:00:00.000Z" }),
    };
    const result = filterByPeriod(
      joinProgress(problems, progress),
      Date.parse("2026-07-27T00:00:00.000Z"),
      Date.parse("2026-07-28T00:00:00.000Z")
    );
    expect(result.map((p) => p.id)).toEqual([2, 1]);
  });
});

describe("unsolved handling", () => {
  it("counts as attempted but not solved", () => {
    const progress: ProgressMap = {
      1: record({ mastery: "unsolved", lastMasteryAt: NOW.toISOString() }),
    };
    const stats = summarize(joinProgress(problems, progress));
    expect(stats.attempted).toBe(1);
    expect(stats.solved).toBe(0);
    expect(stats.unsolved).toBe(1);
  });

  // A failed attempt must never tick the daily goal along.
  it("does not count towards solvedToday", () => {
    const progress: ProgressMap = {
      1: record({ mastery: "unsolved", lastMasteryAt: NOW.toISOString() }),
      2: record({ mastery: "learning", lastMasteryAt: NOW.toISOString() }),
    };
    expect(summarize(joinProgress(problems, progress)).solvedToday).toBe(1);
  });

  it("becomes due the next day, like learning", () => {
    const progress: ProgressMap = {
      1: record({ mastery: "unsolved", lastMasteryAt: "2026-07-27T10:00:00.000Z" }),
    };
    expect(joinProgress(problems, progress)[0].due).toBe(true);
  });

  it("is not due on the same day", () => {
    const progress: ProgressMap = {
      1: record({ mastery: "unsolved", lastMasteryAt: NOW.toISOString() }),
    };
    expect(joinProgress(problems, progress)[0].due).toBe(false);
  });
});

describe("suggestNext", () => {
  it("prefers due reviews over new problems", () => {
    const progress: ProgressMap = {
      2: record({ mastery: "learning", lastMasteryAt: "2026-07-20T10:00:00.000Z" }),
    };
    expect(suggestNext(joinProgress(problems, progress))?.id).toBe(2);
  });

  it("picks the weakest mastery among due problems", () => {
    const old = "2026-06-01T10:00:00.000Z";
    const progress: ProgressMap = {
      1: record({ mastery: "mastered", lastMasteryAt: old }),
      2: record({ mastery: "learning", lastMasteryAt: old }),
    };
    expect(suggestNext(joinProgress(problems, progress))?.id).toBe(2);
  });

  it("prioritises unsolved above everything else that is due", () => {
    const old = "2026-06-01T10:00:00.000Z";
    const progress: ProgressMap = {
      1: record({ mastery: "learning", lastMasteryAt: old }),
      2: record({ mastery: "unsolved", lastMasteryAt: old }),
      3: record({ mastery: "mastered", lastMasteryAt: old }),
    };
    expect(suggestNext(joinProgress(problems, progress))?.id).toBe(2);
  });

  it("falls back to the easiest unseen problem", () => {
    expect(suggestNext(joinProgress(problems, {}))?.difficulty).toBe("Easy");
  });

  it("returns null once everything is done and nothing is due", () => {
    const today = NOW.toISOString();
    const progress: ProgressMap = {
      1: record({ mastery: "mastered", lastMasteryAt: today }),
      2: record({ mastery: "mastered", lastMasteryAt: today }),
      3: record({ mastery: "mastered", lastMasteryAt: today }),
    };
    expect(suggestNext(joinProgress(problems, progress))).toBeNull();
  });
});
