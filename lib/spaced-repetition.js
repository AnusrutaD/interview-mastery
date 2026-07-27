import { getISTMidnight } from "@/lib/timezone";

// Spaced repetition intervals per mastery level (in days)
export const REVIEW_INTERVALS = {
  learning:  1,   // review tomorrow
  familiar:  3,   // review in 3 days
  mastered:  7,   // review in 1 week
};

/**
 * Returns true if a problem is due for review.
 * "unseen" problems are never "due" — they haven't been started.
 */
export function isDue(mastery, updatedAt) {
  if (!mastery || mastery === "unseen" || !updatedAt) return false;
  const interval = REVIEW_INTERVALS[mastery];
  if (!interval) return false;
  // Compare calendar days so "solved yesterday + interval=1" is due today
  // regardless of what time of day the problem was solved.
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const toISTDay = (d) => {
    const ist = new Date(new Date(d).getTime() + IST_OFFSET_MS);
    return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));
  };
  const solvedDay = toISTDay(updatedAt);
  const today = toISTDay(new Date());
  const calendarDaysSince = Math.round((today - solvedDay) / (24 * 60 * 60 * 1000));
  return calendarDaysSince >= interval;
}

/**
 * Returns how many days until the next review (negative = overdue).
 */
export function daysUntilReview(mastery, updatedAt) {
  if (!mastery || mastery === "unseen" || !updatedAt) return null;
  const interval = REVIEW_INTERVALS[mastery];
  if (!interval) return null;
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const toISTDay = (d) => {
    const ist = new Date(new Date(d).getTime() + IST_OFFSET_MS);
    return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));
  };
  const solvedDay = toISTDay(updatedAt);
  const today = toISTDay(new Date());
  const calendarDaysSince = Math.round((today - solvedDay) / (24 * 60 * 60 * 1000));
  return interval - calendarDaysSince;
}

/**
 * Returns a human-readable review status label.
 */
export function reviewLabel(mastery, updatedAt) {
  const days = daysUntilReview(mastery, updatedAt);
  if (days === null) return null;
  if (days <= 0) return "Due for review";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days}d`;
}
