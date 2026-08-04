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
