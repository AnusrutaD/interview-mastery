/**
 * The NeetCode 150 as a `ProblemCatalog`.
 *
 * This is the seed adapter. It wraps the hardcoded array in `problems.ts` and
 * presents it through the port, which means every consumer can stop importing
 * the array directly — and, once the collection-backed adapter lands, can be
 * pointed at the user's own list without changing a line.
 *
 * The mapping is where the old conflation is undone. `Problem.id` was doing
 * four jobs; here it is split:
 *
 *   id → slug      identity, derived from the LeetCode URL
 *   id → order     curriculum position, now freely rewritable
 *   id → legacyId  kept only so existing briefs and bookmarks resolve
 *
 * Nothing new is invented: the slug is the same one the backfill already wrote
 * to `Item.externalId` and the same one the Chrome extension posts, so all
 * three agree by construction rather than by coincidence.
 */
import { catalogFrom, slugFromUrl, type CatalogProblem, type ProblemCatalog } from "@/core/domain/catalog";
import { PROBLEMS } from "./problems";

function toCatalogProblem(problem: (typeof PROBLEMS)[number]): CatalogProblem {
  return {
    // Falling back to the id keeps the key unique for a malformed URL. A shared
    // fallback would collapse every bad row onto one entry.
    slug: slugFromUrl(problem.url) ?? String(problem.id),
    title: problem.title,
    difficulty: problem.difficulty,
    category: problem.category,
    leetcode: problem.leetcode,
    url: problem.url,
    order: problem.id,
    legacyId: problem.id,
  };
}

export const STATIC_CATALOG_ENTRIES: readonly CatalogProblem[] =
  PROBLEMS.map(toCatalogProblem);

/**
 * The catalogue the app reads today.
 *
 * Built once at module load — the source array is `readonly` and cannot change
 * at runtime, so there is nothing to invalidate.
 */
export const staticCatalog: ProblemCatalog = catalogFrom(STATIC_CATALOG_ENTRIES);
