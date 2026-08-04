/**
 * Revisions: clearing a due item by going back over it, without re-solving.
 *
 * Tracked separately from solving on purpose. Folding the two together would
 * make a day of skimming notes indistinguishable from a day of real work, and
 * the whole value of a revision counter is that it measures a different thing.
 * So revisions get their own count, their own timestamp and their own targets.
 *
 * WHAT A REVISION TARGET COUNTS — this is a real modelling decision, not an
 * implementation detail:
 *
 *   A target of "20 this week" means twenty *distinct items* revised this week,
 *   not twenty revision events. Only the most recent revision per item is
 *   stored (`lastRevisedAt`), so revising the same item three times in a week
 *   counts once.
 *
 * That is a limitation of storing a timestamp rather than an event log, but it
 * is also the more useful metric: the point of a weekly revision goal is
 * breadth of coverage, and a target you could satisfy by hammering one item
 * twenty times would measure nothing at all. If per-event history is ever
 * needed — for an activity graph, say — that requires a revision log table and
 * this definition should be revisited rather than quietly stretched.
 */
import { measureTarget, type Target, type TargetProgress } from "./target";

/** One item's revision record, as far as targets are concerned. */
export interface RevisionRecord {
  lastRevisedAt: string | Date | null;
}

/**
 * Contributions for a revision target.
 *
 * `seconds` is zero because revisions are only ever counted, never timed — a
 * minutes-based revision target would be measuring nothing we record.
 */
export function toRevisionContributions(
  items: readonly RevisionRecord[]
): { at: string | Date; seconds: number }[] {
  return items
    .filter((item): item is RevisionRecord & { lastRevisedAt: string | Date } =>
      Boolean(item.lastRevisedAt)
    )
    .map((item) => ({ at: item.lastRevisedAt, seconds: 0 }));
}

/**
 * Progress toward a revision target.
 *
 * The unit is forced to `count`: minutes would silently measure zero, since
 * revision contributions carry no duration.
 */
export function measureRevisionTarget(
  target: Target,
  items: readonly RevisionRecord[],
  now: number = Date.now()
): TargetProgress {
  return measureTarget(
    { ...target, unit: "count" },
    toRevisionContributions(items),
    now
  );
}

/** "12 revised this week" — distinct from the solve target's phrasing. */
export function describeRevisionProgress(progress: TargetProgress): string {
  const period =
    progress.target.period === "daily"
      ? "today"
      : progress.target.period === "weekly"
        ? "this week"
        : "this month";
  return `${progress.done} / ${progress.target.value} revised ${period}`;
}
