import "server-only";
import { toMasteryLevel } from "@/core/domain/mastery";
import type { ProgressMap, ProgressRecord } from "@/core/domain/progress";
import { buildProblemIdBySlug, slugForProblem } from "@/core/domain/dsaCatalog";
import { dedupeKeyFor } from "@/core/domain/collection";
import { PROBLEMS, getProblemById, getProblemBySlug, getProblemsByCategory } from "@/data/problems";
import { prisma } from "../db/prisma";
import { ApiError } from "../http/handler";
import type { UpsertProgressInput } from "../validation/progress.schema";

/**
 * The DSA track, read from `ItemProgress` instead of the legacy `Progress` table.
 *
 * This deliberately mirrors `progress.service.ts` function for function, with
 * identical inputs and return types. That is the whole point: the dashboard,
 * topic pages, activity page, profile and the extension endpoint all keep
 * speaking in catalogue ids and `ProgressMap`, so cutting the track over becomes
 * a change of import in the route handlers rather than a rewrite of every
 * caller. It also means the cutover can be reverted by changing those imports
 * back, which is what makes it safe to ship incrementally.
 *
 * Translation between the two worlds — catalogue id ↔ LeetCode slug — lives in
 * `core/domain/dsaCatalog.ts` and is shared with the backfill script.
 */

export const DSA_TEMPLATE_KEY = "neetcode-150";

const PROGRESS_SELECT = {
  mastery: true,
  notes: true,
  companies: true,
  repeatCount: true,
  totalTimeSeconds: true,
  lastPracticedAt: true,
  updatedAt: true,
  item: { select: { externalId: true } },
} as const;

type ItemProgressRow = {
  mastery: string;
  notes: string | null;
  companies: string[];
  repeatCount: number;
  totalTimeSeconds: number;
  lastPracticedAt: Date | null;
  updatedAt: Date;
  item: { externalId: string | null };
};

function toRecord(row: ItemProgressRow): ProgressRecord {
  return {
    mastery: toMasteryLevel(row.mastery),
    notes: row.notes,
    companies: row.companies ?? [],
    repeatCount: row.repeatCount ?? 0,
    totalTimeSeconds: row.totalTimeSeconds ?? 0,
    // `lastPracticedAt` is this model's name for `lastMasteryAt`. The fallback to
    // `updatedAt` matches the legacy read path, so rows migrated from before the
    // column existed still appear in activity and review scheduling.
    lastMasteryAt: (row.lastPracticedAt ?? row.updatedAt)?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

/* ── Collection resolution ────────────────────────────────────────────────── */

/**
 * The user's seeded DSA collection, or null.
 *
 * Read paths must not create it. A user who has never practised should see an
 * empty progress map — the 150 problems themselves come from the static
 * catalogue, so the dashboard renders correctly either way — and a GET that
 * silently writes 151 rows is a surprise nobody wants.
 */
async function findDsaCollection(userId: string): Promise<{ id: string } | null> {
  return prisma.collection.findFirst({
    where: { userId, templateKey: DSA_TEMPLATE_KEY },
    select: { id: true },
  });
}

/**
 * The user's seeded DSA collection, creating it and its 150 items if absent.
 *
 * Only ever called from write paths. Idempotent: an interrupted seed is
 * completed by the next call, because items are keyed on `externalId` and
 * skipped when already present.
 */
async function ensureDsaCollection(userId: string): Promise<string> {
  const existing = await findDsaCollection(userId);
  const collectionId =
    existing?.id ??
    (
      await prisma.collection.create({
        data: {
          userId,
          name: "NeetCode 150",
          description: "Curated DSA problem set. Practice and judge on LeetCode.",
          source: "builtin",
          sourceUrl: "https://neetcode.io/practice",
          templateKey: DSA_TEMPLATE_KEY,
          icon: "⚡",
          position: 0,
        },
        select: { id: true },
      })
    ).id;

  const seeded = await prisma.item.count({ where: { collectionId } });
  if (seeded >= PROBLEMS.length) return collectionId;

  const present = new Set(
    (
      await prisma.item.findMany({ where: { collectionId }, select: { externalId: true } })
    ).map((i) => i.externalId)
  );

  const missing = PROBLEMS.filter((p) => !present.has(slugForProblem(p))).map((problem) => {
    const slug = slugForProblem(problem);
    return {
      collectionId,
      title: problem.title,
      url: problem.url,
      kind: "problem",
      externalId: slug,
      dedupeKey: dedupeKeyFor({ externalId: slug, url: problem.url }),
      difficulty: problem.difficulty,
      topic: problem.category,
      position: problem.id,
      // Keeps the catalogue id addressable from the item, so briefs and any
      // legacy deep links still resolve.
      metadata: { legacyProblemId: problem.id, leetcodeNumber: problem.leetcode },
    };
  });

  if (missing.length > 0) {
    await prisma.item.createMany({ data: missing, skipDuplicates: true });
  }
  return collectionId;
}

/* ── Reads ────────────────────────────────────────────────────────────────── */

export interface ListProgressOptions {
  category?: string;
  ids?: number[];
}

export async function listProgress(
  userId: string,
  options: ListProgressOptions = {}
): Promise<ProgressMap> {
  const collection = await findDsaCollection(userId);
  if (!collection) return {};

  let problemIds: number[] | undefined = options.ids;
  if (options.category) {
    const categoryIds = getProblemsByCategory(options.category).map((p) => p.id);
    problemIds = problemIds ? problemIds.filter((id) => categoryIds.includes(id)) : categoryIds;
  }

  // Scoping by slug keeps topic pages from pulling all 150 rows, matching what
  // the legacy service did with `problemId: { in: [...] }`.
  const slugs = problemIds
    ?.map((id) => getProblemById(id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map(slugForProblem);

  const rows = await prisma.itemProgress.findMany({
    where: {
      userId,
      item: {
        collectionId: collection.id,
        ...(slugs ? { externalId: { in: slugs } } : {}),
      },
    },
    select: PROGRESS_SELECT,
  });

  const problemIdBySlug = buildProblemIdBySlug(PROBLEMS);
  const map: ProgressMap = {};
  for (const row of rows) {
    const problemId = row.item.externalId
      ? problemIdBySlug.get(row.item.externalId)
      : undefined;
    // Items added to the seeded collection by hand are not catalogue problems
    // and have no place in a DSA progress map.
    if (problemId !== undefined) map[problemId] = toRecord(row);
  }
  return map;
}

export async function getProgress(
  userId: string,
  problemId: number
): Promise<ProgressRecord | null> {
  const problem = getProblemById(problemId);
  if (!problem) return null;

  const collection = await findDsaCollection(userId);
  if (!collection) return null;

  const row = await prisma.itemProgress.findFirst({
    where: {
      userId,
      item: { collectionId: collection.id, externalId: slugForProblem(problem) },
    },
    select: PROGRESS_SELECT,
  });
  return row ? toRecord(row) : null;
}

/** Every practice timestamp for the user — the raw input to streak maths. */
export async function listPracticeTimestamps(userId: string): Promise<string[]> {
  const collection = await findDsaCollection(userId);
  if (!collection) return [];

  const rows = await prisma.itemProgress.findMany({
    where: { userId, item: { collectionId: collection.id }, mastery: { not: "unseen" } },
    select: { lastPracticedAt: true, updatedAt: true },
    orderBy: { lastPracticedAt: "desc" },
  });
  return rows
    .map((r) => (r.lastPracticedAt ?? r.updatedAt)?.toISOString())
    .filter((v): v is string => Boolean(v));
}

/* ── Writes ───────────────────────────────────────────────────────────────── */

function resolveProblem(input: UpsertProgressInput) {
  if (input.problemId !== undefined) {
    const problem = getProblemById(input.problemId);
    if (!problem) throw ApiError.notFound(`Unknown problem id: ${input.problemId}`);
    return problem;
  }
  const problem = getProblemBySlug(input.leetcodeSlug!);
  if (!problem) throw ApiError.notFound(`Problem not in NeetCode 150: ${input.leetcodeSlug}`);
  return problem;
}

/**
 * Upsert a progress row.
 *
 * The field-update semantics are copied deliberately from the legacy service
 * and are load-bearing:
 *
 *  - `mastery` present → deliberate practice. Bump `repeatCount` and stamp
 *    `lastPracticedAt`, which drives review scheduling and activity history.
 *  - `mastery` absent  → a notes save or a timer flush. Must NOT touch
 *    `repeatCount`/`lastPracticedAt`, or saving a note would count as practice
 *    and reset the review schedule.
 *  - `timeSeconds`     → always additive and independent, so the timer can flush
 *    after an externally-recorded submission without double-counting.
 */
export async function upsertProgress(
  userId: string,
  input: UpsertProgressInput
): Promise<ProgressRecord & { problemId: number }> {
  const problem = resolveProblem(input);
  const collectionId = await ensureDsaCollection(userId);

  const item = await prisma.item.findFirst({
    where: { collectionId, externalId: slugForProblem(problem) },
    select: { id: true },
  });
  // ensureDsaCollection just seeded the catalogue, so this should be
  // unreachable; failing loudly beats writing progress to the wrong row.
  if (!item) throw ApiError.notFound(`Item missing for problem: ${problem.id}`);

  const isPractice = input.mastery !== undefined;
  const now = new Date();
  const seconds = input.timeSeconds ?? 0;

  const row = await prisma.itemProgress.upsert({
    where: { userId_itemId: { userId, itemId: item.id } },
    update: {
      ...(isPractice && {
        mastery: input.mastery,
        repeatCount: { increment: 1 },
        lastPracticedAt: now,
      }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.companies !== undefined && { companies: input.companies }),
      ...(seconds > 0 && { totalTimeSeconds: { increment: seconds } }),
    },
    create: {
      userId,
      itemId: item.id,
      mastery: input.mastery ?? "unseen",
      notes: input.notes ?? null,
      companies: input.companies ?? [],
      repeatCount: isPractice ? 1 : 0,
      totalTimeSeconds: seconds,
      lastPracticedAt: isPractice ? now : null,
    },
    select: PROGRESS_SELECT,
  });

  return { problemId: problem.id, ...toRecord(row) };
}

/**
 * No-op, kept so this module stays a drop-in replacement.
 *
 * Orphans were rows whose `problemId` was not in the catalogue — damage from an
 * old extension bug. Items are seeded from the catalogue and progress hangs off
 * an item foreign key, so the condition cannot arise here.
 */
export async function pruneOrphanedProgress(_userId: string): Promise<number> {
  return 0;
}
