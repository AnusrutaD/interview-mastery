/**
 * The bridge between the legacy catalogue and the collection model.
 *
 * The DSA track is keyed on a numeric catalogue id (`Problem.id`, 1–150). The
 * collection model is keyed on `Item.externalId`, which the backfill sets to the
 * LeetCode slug. Every read or write that crosses between the two needs the same
 * translation, so it lives here once rather than being re-derived — the
 * migration script and the service getting slightly different regexes is exactly
 * the sort of drift that silently loses a user's history.
 */
import type { Problem } from "./progress";

/**
 * The slug the backfill stores in `Item.externalId`.
 *
 * Falls back to the stringified catalogue id so a malformed URL still produces a
 * stable, unique key rather than colliding every bad row onto one item.
 */
export function slugForProblem(problem: Pick<Problem, "id" | "url">): string {
  return problem.url.match(/\/problems\/([^/]+)/)?.[1] ?? String(problem.id);
}

/** slug → catalogue id, for turning collection rows back into DSA records. */
export function buildProblemIdBySlug(
  problems: readonly Pick<Problem, "id" | "url">[]
): Map<string, number> {
  const index = new Map<string, number>();
  for (const problem of problems) index.set(slugForProblem(problem), problem.id);
  return index;
}

/** catalogue id → slug, for the write path. */
export function buildSlugByProblemId(
  problems: readonly Pick<Problem, "id" | "url">[]
): Map<number, string> {
  const index = new Map<number, string>();
  for (const problem of problems) index.set(problem.id, slugForProblem(problem));
  return index;
}
