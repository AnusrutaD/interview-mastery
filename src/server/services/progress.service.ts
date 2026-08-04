import "server-only";
import type { Progress } from "@prisma/client";
import { toMasteryLevel } from "@/core/domain/mastery";
import type { ProgressMap, ProgressRecord } from "@/core/domain/progress";
import { getProblemById, getProblemBySlug, getProblemsByCategory } from "@/data/problems";
import { prisma } from "../db/prisma";
import { ApiError } from "../http/handler";
import type { UpsertProgressInput } from "../validation/progress.schema";

/** Columns the client actually needs. Avoids over-selecting. */
const PROGRESS_SELECT = {
  problemId: true,
  mastery: true,
  notes: true,
  companies: true,
  repeatCount: true,
  totalTimeSeconds: true,
  lastMasteryAt: true,
  updatedAt: true,
} satisfies Record<string, true>;

type ProgressRow = Pick<Progress, keyof typeof PROGRESS_SELECT>;

/**
 * Map a DB row to the domain record.
 *
 * `lastMasteryAt` falls back to `updatedAt` for rows written before the column
 * existed, so historical data still appears in activity and scheduling.
 */
function toRecord(row: ProgressRow): ProgressRecord {
  return {
    mastery: toMasteryLevel(row.mastery),
    notes: row.notes,
    companies: row.companies ?? [],
    repeatCount: row.repeatCount ?? 0,
    totalTimeSeconds: row.totalTimeSeconds ?? 0,
    lastMasteryAt: (row.lastMasteryAt ?? row.updatedAt)?.toISOString() ?? null,
    // Revisions and review flags live only in the collection model. `Progress`
    // is frozen and will never gain these columns, so this path reports the
    // empty state rather than pretending to know — it is only reachable if the
    // cutover is reverted.
    revisionCount: 0,
    lastRevisedAt: null,
    flaggedForReviewAt: null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

function toMap(rows: ProgressRow[]): ProgressMap {
  const map: ProgressMap = {};
  for (const row of rows) map[row.problemId] = toRecord(row);
  return map;
}

export interface ListProgressOptions {
  /** Restrict to a category — lets topic pages avoid fetching all 150. */
  category?: string;
  /** Restrict to specific problem ids. */
  ids?: number[];
}

export async function listProgress(
  userId: string,
  options: ListProgressOptions = {}
): Promise<ProgressMap> {
  let problemIds: number[] | undefined = options.ids;

  if (options.category) {
    const categoryIds = getProblemsByCategory(options.category).map((p) => p.id);
    problemIds = problemIds
      ? problemIds.filter((id) => categoryIds.includes(id))
      : categoryIds;
  }

  const rows = await prisma.progress.findMany({
    where: { userId, ...(problemIds ? { problemId: { in: problemIds } } : {}) },
    select: PROGRESS_SELECT,
  });

  return toMap(rows);
}

export async function getProgress(userId: string, problemId: number): Promise<ProgressRecord | null> {
  const row = await prisma.progress.findUnique({
    where: { userId_problemId: { userId, problemId } },
    select: PROGRESS_SELECT,
  });
  return row ? toRecord(row) : null;
}

/** Resolve the target problem id from either identifier the clients use. */
function resolveProblemId(input: UpsertProgressInput): number {
  if (input.problemId !== undefined) {
    if (!getProblemById(input.problemId)) {
      throw ApiError.notFound(`Unknown problem id: ${input.problemId}`);
    }
    return input.problemId;
  }
  const problem = getProblemBySlug(input.leetcodeSlug!);
  if (!problem) {
    throw ApiError.notFound(`Problem not in NeetCode 150: ${input.leetcodeSlug}`);
  }
  return problem.id;
}

/**
 * Upsert a progress row.
 *
 * Field-update semantics matter here and are load-bearing:
 *
 *  - `mastery` present  → this is deliberate practice. Bump `repeatCount` and
 *    stamp `lastMasteryAt`, which drives review scheduling and activity history.
 *  - `mastery` absent   → a notes save or a time flush. Must NOT touch
 *    `repeatCount`/`lastMasteryAt`, otherwise saving a note would count as a
 *    practice session and reset the review schedule.
 *  - `timeSeconds`      → always additive, independent of the above, so the
 *    timer can flush after an externally-recorded submission without
 *    double-counting the attempt.
 */
export async function upsertProgress(
  userId: string,
  input: UpsertProgressInput
): Promise<ProgressRecord & { problemId: number }> {
  const problemId = resolveProblemId(input);
  const isPractice = input.mastery !== undefined;
  const now = new Date();
  const seconds = input.timeSeconds ?? 0;

  const row = await prisma.progress.upsert({
    where: { userId_problemId: { userId, problemId } },
    update: {
      ...(isPractice && {
        mastery: input.mastery,
        repeatCount: { increment: 1 },
        lastMasteryAt: now,
      }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.companies !== undefined && { companies: input.companies }),
      ...(seconds > 0 && { totalTimeSeconds: { increment: seconds } }),
    },
    create: {
      userId,
      problemId,
      mastery: input.mastery ?? "unseen",
      notes: input.notes ?? null,
      companies: input.companies ?? [],
      repeatCount: isPractice ? 1 : 0,
      totalTimeSeconds: seconds,
      lastMasteryAt: isPractice ? now : null,
    },
    select: PROGRESS_SELECT,
  });

  return { problemId, ...toRecord(row) };
}

/** Every practice timestamp for the user — the raw input to streak maths. */
export async function listPracticeTimestamps(userId: string): Promise<string[]> {
  const rows = await prisma.progress.findMany({
    where: { userId, mastery: { not: "unseen" } },
    select: { lastMasteryAt: true, updatedAt: true },
    orderBy: { lastMasteryAt: "desc" },
  });
  return rows
    .map((r) => (r.lastMasteryAt ?? r.updatedAt)?.toISOString())
    .filter((v): v is string => Boolean(v));
}

/** Drop rows for problems no longer in the catalogue. */
export async function pruneOrphanedProgress(userId: string): Promise<number> {
  const rows = await prisma.progress.findMany({ where: { userId }, select: { problemId: true } });
  const orphaned = rows.map((r) => r.problemId).filter((id) => !getProblemById(id));
  if (orphaned.length === 0) return 0;
  const { count } = await prisma.progress.deleteMany({
    where: { userId, problemId: { in: orphaned } },
  });
  return count;
}
