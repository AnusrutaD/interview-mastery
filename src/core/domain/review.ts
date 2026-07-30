/**
 * Spaced-repetition scheduling.
 *
 * IMPORTANT — which timestamp drives the schedule:
 * Scheduling keys off `lastMasteryAt` (set only when the user deliberately
 * records a mastery level), NOT Prisma's `updatedAt`. `updatedAt` is bumped by
 * any write — including saving notes — which silently reset a problem's review
 * schedule every time the user edited their notes. Callers must pass the
 * practice timestamp, never the row's `updatedAt`.
 */
import { istDaysBetween } from "../time/ist";
import type { MasteryLevel } from "./mastery";

/**
 * Days to wait before a problem at each level is due again.
 *
 * `unsolved` shares the shortest interval: a problem that beat you should come
 * back tomorrow, while the attempt is still fresh.
 */
export const REVIEW_INTERVAL_DAYS: Record<Exclude<MasteryLevel, "unseen">, number> = {
  unsolved: 1,
  learning: 1,
  familiar: 3,
  mastered: 7,
};

export type ReviewTimestamp = Date | string | number | null | undefined;

export function reviewIntervalFor(level: MasteryLevel): number | null {
  return level === "unseen" ? null : REVIEW_INTERVAL_DAYS[level];
}

/**
 * Days remaining until the next review. Negative means overdue.
 * `null` when the problem has no schedule (never practised / unseen).
 */
export function daysUntilReview(level: MasteryLevel, practisedAt: ReviewTimestamp): number | null {
  const interval = reviewIntervalFor(level);
  if (interval === null || !practisedAt) return null;
  return interval - istDaysBetween(practisedAt);
}

/** True when the problem should be reviewed today (or is overdue). */
export function isDue(level: MasteryLevel, practisedAt: ReviewTimestamp): boolean {
  const days = daysUntilReview(level, practisedAt);
  return days !== null && days <= 0;
}

/** Human-readable schedule status, or null when unscheduled. */
export function reviewLabel(level: MasteryLevel, practisedAt: ReviewTimestamp): string | null {
  const days = daysUntilReview(level, practisedAt);
  if (days === null) return null;
  if (days < 0) return `Overdue by ${Math.abs(days)}d`;
  if (days === 0) return "Due for review";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days}d`;
}
