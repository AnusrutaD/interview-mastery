/**
 * The live catalogue.
 *
 * One module decides which adapter the app reads, so swapping the static seed
 * for the user's own collection is a change here rather than a change in every
 * consumer. That is the entire purpose of the port: the previous design had
 * fourteen modules importing the concrete array, which left nowhere to stand.
 *
 * Currently the static seed. Phase 3 of the catalogue refactor swaps this for a
 * collection-backed adapter once the backfill has run — at which point adding,
 * removing and reordering problems become ordinary data operations rather than
 * source edits and a redeploy.
 */
import type { ProblemCatalog } from "@/core/domain/catalog";
import { staticCatalog } from "./staticCatalog";

export const catalog: ProblemCatalog = staticCatalog;

/**
 * The canonical URL for a problem, from whichever identifier the caller holds.
 *
 * Most UI still carries the legacy integer id, because progress is stored
 * against it. Resolving here means those call sites emit the slug URL directly
 * rather than relying on the redirect — which works, but costs a round trip on
 * every click and leaves the old address looking canonical.
 *
 * Returns null when the id resolves to nothing, so callers can omit the link
 * rather than render one that 404s.
 */
export function problemHref(
  id: number | string,
  options: { scope?: string } = {}
): string | null {
  const problem = typeof id === "number" ? catalog.byLegacyId(id) : catalog.bySlug(id);
  if (!problem) return null;
  return options.scope
    ? `/problems/${problem.slug}?from=${encodeURIComponent(options.scope)}`
    : `/problems/${problem.slug}`;
}
