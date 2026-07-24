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
  const msSinceReview = Date.now() - new Date(updatedAt).getTime();
  return msSinceReview >= interval * 24 * 60 * 60 * 1000;
}

/**
 * Returns how many days until the next review (negative = overdue).
 */
export function daysUntilReview(mastery, updatedAt) {
  if (!mastery || mastery === "unseen" || !updatedAt) return null;
  const interval = REVIEW_INTERVALS[mastery];
  if (!interval) return null;
  const daysSince = (Date.now() - new Date(updatedAt).getTime()) / (24 * 60 * 60 * 1000);
  return Math.ceil(interval - daysSince);
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
