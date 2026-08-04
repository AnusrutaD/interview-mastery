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

/**
 * Everything that can affect whether an item is due.
 *
 * Kept as an object rather than more positional arguments because the three
 * timestamps are easy to transpose and the resulting bug — a schedule that
 * resets on the wrong event — is silent.
 */
export interface ReviewState {
  mastery: MasteryLevel;
  /** Set when mastery was deliberately recorded. Solving. */
  lastPracticedAt: ReviewTimestamp;
  /** Set when the item was revised without re-solving. */
  lastRevisedAt?: ReviewTimestamp;
  /** Set when the user explicitly asked to see this again. */
  flaggedForReviewAt?: ReviewTimestamp;
}

function toMillis(value: ReviewTimestamp): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/**
 * The timestamp the schedule counts from.
 *
 * Revising counts as review, so it pushes the next due date out exactly as
 * solving does — the later of the two wins. Without this, reading your notes
 * would clear nothing and the item would stay due forever.
 */
export function reviewAnchor(state: ReviewState): ReviewTimestamp {
  const practised = toMillis(state.lastPracticedAt);
  const revised = toMillis(state.lastRevisedAt);
  if (practised === null) return revised === null ? null : new Date(revised);
  if (revised === null) return new Date(practised);
  return new Date(Math.max(practised, revised));
}

/**
 * Whether a manual flag still outranks the last review.
 *
 * The comparison is `>=`, not `>`, and that matters: flagging a problem you
 * solved earlier today gives a flag timestamp equal to the anchor once both
 * land in the same millisecond, and under `>` the flag would lose and the item
 * would stay not-due — defeating the entire feature.
 *
 * The reverse ordering is handled at the source rather than here: practising or
 * revising clears the flag outright, so a stale flag cannot linger.
 */
function flagOutranksReview(state: ReviewState): boolean {
  const flagged = toMillis(state.flaggedForReviewAt);
  if (flagged === null) return false;
  const anchorMs = toMillis(reviewAnchor(state));
  return anchorMs === null || flagged >= anchorMs;
}

/**
 * Due state including revisions and manual flags.
 *
 * A manual flag wins over the schedule while it is at least as new as the last
 * review — otherwise flagging an item once would pin it as due forever, and
 * revising it would appear to do nothing.
 */
export function isDueNow(state: ReviewState): boolean {
  if (flagOutranksReview(state)) return true;
  return isDue(state.mastery, reviewAnchor(state));
}

/**
 * Whether a manual flag is still in force.
 *
 * Drives the UI badge: an item due because *you* asked for it reads differently
 * from one the schedule surfaced.
 */
export function isFlaggedForReview(state: ReviewState): boolean {
  return flagOutranksReview(state);
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
