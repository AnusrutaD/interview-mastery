/**
 * Pure mapping used by the Progress → ItemProgress backfill.
 *
 * Extracted from the script so the risky part — deciding what each legacy row
 * becomes — is unit-tested rather than only exercised against a live database.
 * The script stays a thin loop over these functions.
 */
import type { MasteryLevel } from "./mastery";
import { toMasteryLevel } from "./mastery";
import { dedupeKeyFor } from "./collection";

/** The shape of a legacy `Progress` row, as far as the mapping cares. */
export interface LegacyProgressRow {
  problemId: number;
  mastery: string;
  notes: string | null;
  companies?: string[] | null;
  repeatCount?: number | null;
  totalTimeSeconds?: number | null;
  /** Old name for lastPracticedAt. May be absent on very old rows. */
  lastMasteryAt?: Date | string | null;
  updatedAt: Date | string;
}

export interface CatalogueProblem {
  id: number;
  title: string;
  url: string;
  difficulty: string;
  category: string;
  leetcode: string;
}

export interface MappedItem {
  title: string;
  url: string;
  kind: "problem";
  externalId: string;
  dedupeKey: string | null;
  difficulty: string;
  topic: string;
  position: number;
  metadata: { legacyProblemId: number; leetcodeNumber: string };
}

export interface MappedProgress {
  mastery: MasteryLevel;
  notes: string | null;
  companies: string[];
  repeatCount: number;
  totalTimeSeconds: number;
  lastPracticedAt: string;
}

/** LeetCode slug from a problem URL — the stable external identity. */
export function slugForProblem(problem: Pick<CatalogueProblem, "id" | "url">): string {
  return problem.url.match(/\/problems\/([^/]+)/)?.[1] ?? String(problem.id);
}

export function mapProblemToItem(problem: CatalogueProblem): MappedItem {
  const externalId = slugForProblem(problem);
  return {
    title: problem.title,
    url: problem.url,
    kind: "problem",
    externalId,
    dedupeKey: dedupeKeyFor({ externalId, url: problem.url }),
    difficulty: problem.difficulty,
    topic: problem.category,
    position: problem.id,
    metadata: { legacyProblemId: problem.id, leetcodeNumber: problem.leetcode },
  };
}

/**
 * Map a legacy progress row onto the new shape.
 *
 * `lastMasteryAt` falls back to `updatedAt` exactly as the current read path
 * does, so rows written before that column existed keep their place in the
 * review schedule and activity history rather than silently becoming "never
 * practised".
 */
export function mapProgressRow(row: LegacyProgressRow): MappedProgress {
  const practisedAt = row.lastMasteryAt ?? row.updatedAt;
  return {
    mastery: toMasteryLevel(row.mastery),
    notes: row.notes,
    companies: row.companies ?? [],
    repeatCount: row.repeatCount ?? 0,
    totalTimeSeconds: row.totalTimeSeconds ?? 0,
    lastPracticedAt: new Date(practisedAt).toISOString(),
  };
}

export interface PartitionedRows {
  migratable: LegacyProgressRow[];
  /** Rows referencing ids not in the catalogue — orphans from the old
   *  extension bug that posted LeetCode numbers instead of internal ids. */
  orphaned: LegacyProgressRow[];
}

/**
 * Split rows into what can be migrated and what cannot.
 *
 * Orphans are reported rather than dropped silently or migrated blindly —
 * a migration that quietly loses rows is worse than one that refuses them.
 */
export function partitionRows(
  rows: readonly LegacyProgressRow[],
  knownProblemIds: ReadonlySet<number>
): PartitionedRows {
  const migratable: LegacyProgressRow[] = [];
  const orphaned: LegacyProgressRow[] = [];

  for (const row of rows) {
    if (knownProblemIds.has(row.problemId)) migratable.push(row);
    else orphaned.push(row);
  }

  return { migratable, orphaned };
}

/** Rows expected in the destination after a successful run. */
export function expectedMigratedCount(
  rows: readonly LegacyProgressRow[],
  knownProblemIds: ReadonlySet<number>
): number {
  return partitionRows(rows, knownProblemIds).migratable.length;
}
