/**
 * The Progress domain: a user's record against a single problem, plus the
 * derivations every screen needs. Keeping these as pure functions means the
 * dashboard, topics pages and activity page all compute stats identically.
 */
import { DAY_MS, istDayKey, istDayStart, isISTToday } from "../time/ist";
import type { Difficulty } from "./difficulty";
import { isAttempted, isSolved, type MasteryLevel } from "./mastery";
import { isDue } from "./review";

/** A NeetCode problem — static reference data. */
export interface Problem {
  id: number;
  title: string;
  difficulty: Difficulty;
  category: string;
  /** LeetCode's own problem number, as displayed. */
  leetcode: string;
  url: string;
}

/**
 * An original, condensed restatement of a problem — written for this app, not
 * copied from LeetCode.
 *
 * This is deliberately *not* the full problem statement. When revising you do
 * not want the narrative framing; you want the shape of the input, the idea
 * that unlocks it, and the trap you fell into last time. The canonical
 * statement stays one click away on LeetCode.
 */
export interface ProblemBrief {
  /** What you are being asked to compute, in plain terms. */
  task: string;
  /** Function shape, language-agnostic: `twoSum(nums: int[], target: int) -> int[]`. */
  signature: string;
  /** A worked example written for this app, not copied from anywhere. */
  example: {
    input: string;
    output: string;
    /** Why that output is correct — the part that makes the task unambiguous. */
    why: string;
  };
  /** Input bounds and the edge cases a correct solution must handle. */
  constraints: string[];
  /** The observation the intended solution turns on. */
  insight: string;
  /** Target complexity, e.g. "O(n) time, O(n) space". */
  complexity: string;
  /** The edge case or mistake that most often costs the solve. */
  pitfall?: string;
}

/** The user's record for one problem. Absent means never touched. */
export interface ProgressRecord {
  mastery: MasteryLevel;
  notes: string | null;
  /** Companies the user has personally seen this problem asked at. */
  companies: string[];
  /** Times the user has recorded a mastery level. */
  repeatCount: number;
  totalTimeSeconds: number;
  /** Set only on deliberate practice. Drives scheduling and activity history. */
  lastMasteryAt: string | null;
  /** Row mtime. Bumped by any write — do not use for scheduling. */
  updatedAt: string | null;
}

/** Problem joined with the user's progress. What the UI actually renders. */
export interface ProblemWithProgress extends Problem, ProgressRecord {
  due: boolean;
}

export type ProgressMap = Record<number, ProgressRecord>;

export const EMPTY_PROGRESS: ProgressRecord = {
  mastery: "unseen",
  notes: null,
  companies: [],
  repeatCount: 0,
  totalTimeSeconds: 0,
  lastMasteryAt: null,
  updatedAt: null,
};

/** Join static problems with progress, computing review state once. */
export function joinProgress(problems: readonly Problem[], progress: ProgressMap): ProblemWithProgress[] {
  return problems.map((problem) => {
    const record = progress[problem.id] ?? EMPTY_PROGRESS;
    return {
      ...problem,
      ...record,
      due: isDue(record.mastery, record.lastMasteryAt),
    };
  });
}

/* ── Aggregations ─────────────────────────────────────────────────────────── */

export interface ProgressStats {
  total: number;
  /** Touched at all — includes problems marked unsolved. */
  attempted: number;
  /** Actually got out — excludes unsolved. */
  solved: number;
  /** Currently marked unsolved. The "come back to these" list. */
  unsolved: number;
  due: number;
  /** Counts solves only, so a failed attempt cannot complete the daily goal. */
  solvedToday: number;
  byMastery: Record<MasteryLevel, number>;
  byDifficulty: Record<Difficulty, { total: number; attempted: number }>;
  totalTimeSeconds: number;
  completionPercent: number;
}

export function summarize(problems: readonly ProblemWithProgress[]): ProgressStats {
  const byMastery: Record<MasteryLevel, number> = {
    unseen: 0,
    unsolved: 0,
    learning: 0,
    familiar: 0,
    mastered: 0,
  };
  const byDifficulty: Record<Difficulty, { total: number; attempted: number }> = {
    Easy: { total: 0, attempted: 0 },
    Medium: { total: 0, attempted: 0 },
    Hard: { total: 0, attempted: 0 },
  };

  let attempted = 0;
  let solved = 0;
  let due = 0;
  let solvedToday = 0;
  let totalTimeSeconds = 0;

  for (const p of problems) {
    byMastery[p.mastery] += 1;
    byDifficulty[p.difficulty].total += 1;
    totalTimeSeconds += p.totalTimeSeconds;

    if (isAttempted(p.mastery)) {
      attempted += 1;
      byDifficulty[p.difficulty].attempted += 1;
    }
    if (isSolved(p.mastery)) {
      solved += 1;
      if (p.lastMasteryAt && isISTToday(p.lastMasteryAt)) solvedToday += 1;
    }
    if (p.due) due += 1;
  }

  return {
    total: problems.length,
    attempted,
    solved,
    unsolved: byMastery.unsolved,
    due,
    solvedToday,
    byMastery,
    byDifficulty,
    totalTimeSeconds,
    completionPercent: problems.length ? Math.round((attempted / problems.length) * 100) : 0,
  };
}

/**
 * Current daily streak in IST calendar days.
 *
 * A streak survives only if there is practice today or yesterday — otherwise it
 * has already been broken. Counting back from yesterday when today is empty
 * means the streak is not lost until the day actually ends.
 */
export function calculateStreak(practiceTimestamps: readonly string[]): number {
  if (practiceTimestamps.length === 0) return 0;

  const days = new Set(practiceTimestamps.map((ts) => istDayKey(ts)));

  const todayStart = istDayStart();
  const hasToday = days.has(istDayKey(todayStart));
  const hasYesterday = days.has(istDayKey(todayStart - DAY_MS));
  if (!hasToday && !hasYesterday) return 0;

  let streak = 0;
  let cursor = hasToday ? todayStart : todayStart - DAY_MS;
  while (days.has(istDayKey(cursor))) {
    streak += 1;
    cursor -= DAY_MS;
  }
  return streak;
}

/** Problems practised inside a UTC-timestamp window. Powers the activity page. */
export function filterByPeriod(
  problems: readonly ProblemWithProgress[],
  startUtcMs: number,
  endUtcMs: number
): ProblemWithProgress[] {
  return problems
    .filter((p) => {
      if (!p.lastMasteryAt || !isAttempted(p.mastery)) return false;
      const ts = new Date(p.lastMasteryAt).getTime();
      return ts >= startUtcMs && ts < endUtcMs;
    })
    .sort(
      (a, b) => new Date(b.lastMasteryAt!).getTime() - new Date(a.lastMasteryAt!).getTime()
    );
}

/**
 * The problem to work on next within a set: overdue reviews first (weakest
 * mastery leads), then unseen problems easiest-first to build momentum.
 */
export function suggestNext(problems: readonly ProblemWithProgress[]): ProblemWithProgress | null {
  const dueNow = problems.filter((p) => p.due);
  if (dueNow.length > 0) {
    // Weakest first — an unsolved problem is the most urgent thing in the queue.
    const rank: Record<MasteryLevel, number> = {
      unseen: 0,
      unsolved: 1,
      learning: 2,
      familiar: 3,
      mastered: 4,
    };
    return [...dueNow].sort((a, b) => rank[a.mastery] - rank[b.mastery])[0];
  }
  const unseen = problems.filter((p) => p.mastery === "unseen");
  if (unseen.length === 0) return null;
  const order: Record<Difficulty, number> = { Easy: 0, Medium: 1, Hard: 2 };
  return [...unseen].sort((a, b) => order[a.difficulty] - order[b.difficulty])[0];
}
