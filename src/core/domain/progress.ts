/**
 * The Progress domain: a user's record against a single problem, plus the
 * derivations every screen needs. Keeping these as pure functions means the
 * dashboard, topics pages and activity page all compute stats identically.
 */
import { DAY_MS, istDayKey, istDayStart, isISTToday } from "../time/ist";
import type { Difficulty } from "./difficulty";
import { isAttempted, type MasteryLevel } from "./mastery";
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

/** The user's record for one problem. Absent means never touched. */
export interface ProgressRecord {
  mastery: MasteryLevel;
  notes: string | null;
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
  attempted: number;
  due: number;
  solvedToday: number;
  byMastery: Record<MasteryLevel, number>;
  byDifficulty: Record<Difficulty, { total: number; attempted: number }>;
  totalTimeSeconds: number;
  completionPercent: number;
}

export function summarize(problems: readonly ProblemWithProgress[]): ProgressStats {
  const byMastery: Record<MasteryLevel, number> = {
    unseen: 0,
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
    if (p.due) due += 1;
    if (p.lastMasteryAt && isAttempted(p.mastery) && isISTToday(p.lastMasteryAt)) {
      solvedToday += 1;
    }
  }

  return {
    total: problems.length,
    attempted,
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
    const rank: Record<MasteryLevel, number> = { unseen: 0, learning: 1, familiar: 2, mastered: 3 };
    return [...dueNow].sort((a, b) => rank[a.mastery] - rank[b.mastery])[0];
  }
  const unseen = problems.filter((p) => p.mastery === "unseen");
  if (unseen.length === 0) return null;
  const order: Record<Difficulty, number> = { Easy: 0, Medium: 1, Hard: 2 };
  return [...unseen].sort((a, b) => order[a.difficulty] - order[b.difficulty])[0];
}
