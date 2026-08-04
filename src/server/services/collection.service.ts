import "server-only";
import { isSolved, toMasteryLevel } from "@/core/domain/mastery";
import { describeWatch } from "@/core/domain/watch";
import { insertPositionAfter, shiftForInsert } from "@/core/domain/ordering";
import {
  dedupeKeyFor,
  toCollectionSource,
  toItemKind,
  type Collection,
  type Item,
  type ItemProgressMap,
  type ItemRecord,
} from "@/core/domain/collection";
import { prisma } from "../db/prisma";
import { ApiError } from "../http/handler";
import type {
  CreateCollectionInput,
  ImportItemsInput,
  UpdateCollectionInput,
  UpsertItemProgressInput,
} from "../validation/collection.schema";

/* ── Row mapping ──────────────────────────────────────────────────────────── */

type CollectionRow = {
  id: string;
  name: string;
  description: string | null;
  source: string;
  sourceUrl: string | null;
  templateKey: string | null;
  dailyTarget: number | null;
  weeklyTarget: number | null;
  targetPeriod: string | null;
  targetUnit: string | null;
  targetValue: number | null;
  position: number;
  icon: string | null;
  archived: boolean;
};

function toCollection(row: CollectionRow): Collection {
  return { ...row, source: toCollectionSource(row.source) };
}

type ItemRow = {
  id: string;
  collectionId: string;
  title: string;
  url: string | null;
  kind: string;
  externalId: string | null;
  durationSeconds: number | null;
  difficulty: string | null;
  topic: string | null;
  tags: string[];
  position: number;
  metadata: unknown;
};

function toItem(row: ItemRow): Item {
  return {
    ...row,
    kind: toItemKind(row.kind),
    metadata:
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : null,
  };
}

/**
 * Map an `ItemProgress` row to the domain record.
 *
 * Defined once and used by every read path. This mapping was previously inlined
 * at three call sites, so adding a field to `ItemRecord` broke all three
 * independently — duplication that only announces itself when the shape changes.
 */
function toItemRecord(row: {
  mastery: string;
  notes: string | null;
  companies: string[];
  repeatCount: number;
  totalTimeSeconds: number;
  lastPracticedAt: Date | null;
  revisionCount: number;
  lastRevisedAt: Date | null;
  flaggedForReviewAt: Date | null;
  watchedSeconds: number;
  positionSeconds: number;
}): ItemRecord {
  return {
    mastery: toMasteryLevel(row.mastery),
    notes: row.notes,
    companies: row.companies ?? [],
    repeatCount: row.repeatCount ?? 0,
    totalTimeSeconds: row.totalTimeSeconds ?? 0,
    lastPracticedAt: row.lastPracticedAt?.toISOString() ?? null,
    revisionCount: row.revisionCount ?? 0,
    lastRevisedAt: row.lastRevisedAt?.toISOString() ?? null,
    flaggedForReviewAt: row.flaggedForReviewAt?.toISOString() ?? null,
    watchedSeconds: row.watchedSeconds ?? 0,
    positionSeconds: row.positionSeconds ?? 0,
  };
}

/* ── Ownership ────────────────────────────────────────────────────────────── */

/**
 * Every read and write goes through this.
 *
 * Returning "not found" rather than "forbidden" for someone else's collection
 * is deliberate — a 403 would confirm the id exists.
 */
async function requireOwnedCollection(userId: string, collectionId: string) {
  const collection = await prisma.collection.findFirst({
    where: { id: collectionId, userId },
  });
  if (!collection) throw ApiError.notFound("Collection not found");
  return collection;
}

async function requireOwnedItem(userId: string, itemId: string) {
  const item = await prisma.item.findFirst({
    where: { id: itemId, collection: { userId } },
    include: { collection: { select: { id: true } } },
  });
  if (!item) throw ApiError.notFound("Item not found");
  return item;
}

/* ── Collections ──────────────────────────────────────────────────────────── */

export interface CollectionSummary extends Collection {
  itemCount: number;
  /** Items the user has completed — excludes `unsolved`. */
  completedCount: number;
}

export async function listCollections(
  userId: string,
  options: { includeArchived?: boolean } = {}
): Promise<CollectionSummary[]> {
  const rows = await prisma.collection.findMany({
    where: { userId, ...(options.includeArchived ? {} : { archived: false }) },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { items: true } } },
  });

  if (rows.length === 0) return [];

  // One grouped query for completion counts rather than a query per collection.
  const completed = await prisma.itemProgress.groupBy({
    by: ["itemId"],
    where: {
      userId,
      mastery: { notIn: ["unseen", "unsolved"] },
      item: { collectionId: { in: rows.map((r) => r.id) } },
    },
    _count: true,
  });

  const completedItemIds = new Set(completed.map((c) => c.itemId));
  const itemsByCollection = await prisma.item.findMany({
    where: { id: { in: [...completedItemIds] } },
    select: { id: true, collectionId: true },
  });

  const completedPerCollection = new Map<string, number>();
  for (const item of itemsByCollection) {
    completedPerCollection.set(
      item.collectionId,
      (completedPerCollection.get(item.collectionId) ?? 0) + 1
    );
  }

  return rows.map((row) => ({
    ...toCollection(row),
    itemCount: row._count.items,
    completedCount: completedPerCollection.get(row.id) ?? 0,
  }));
}

export interface CollectionDetail {
  collection: Collection;
  items: Item[];
  progress: ItemProgressMap;
}

export async function getCollection(
  userId: string,
  collectionId: string
): Promise<CollectionDetail> {
  const collection = await requireOwnedCollection(userId, collectionId);

  const items = await prisma.item.findMany({
    where: { collectionId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });

  const progressRows = await prisma.itemProgress.findMany({
    where: { userId, itemId: { in: items.map((i) => i.id) } },
  });

  const progress: ItemProgressMap = {};
  for (const row of progressRows) {
    progress[row.itemId] = toItemRecord(row);
  }

  return { collection: toCollection(collection), items: items.map(toItem), progress };
}

/**
 * `source` is optional here rather than relying on the schema default: Zod's
 * `.default()` makes a field required in the *output* type but optional in the
 * *input* type, and `parseBody` is generic over the input. Defaulting again at
 * the boundary keeps both sides honest.
 */
export async function createCollection(
  userId: string,
  input: Omit<CreateCollectionInput, "source"> & { source?: CreateCollectionInput["source"] }
): Promise<Collection> {
  // New collections land at the end of the user's existing list.
  const last = await prisma.collection.findFirst({
    where: { userId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const row = await prisma.collection.create({
    data: {
      userId,
      name: input.name,
      description: input.description ?? null,
      source: input.source ?? "manual",
      sourceUrl: input.sourceUrl ?? null,
      dailyTarget: input.dailyTarget ?? null,
      weeklyTarget: input.weeklyTarget ?? null,
      targetPeriod: input.targetPeriod ?? "daily",
      targetUnit: input.targetUnit ?? "count",
      targetValue: input.targetValue ?? null,
      icon: input.icon ?? null,
      position: (last?.position ?? -1) + 1,
    },
  });

  return toCollection(row);
}

export async function updateCollection(
  userId: string,
  collectionId: string,
  input: UpdateCollectionInput
): Promise<Collection> {
  await requireOwnedCollection(userId, collectionId);

  const row = await prisma.collection.update({
    where: { id: collectionId },
    // Spread only the provided keys, so an omitted field is untouched while an
    // explicit null clears it.
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.sourceUrl !== undefined && { sourceUrl: input.sourceUrl }),
      ...(input.dailyTarget !== undefined && { dailyTarget: input.dailyTarget }),
      ...(input.weeklyTarget !== undefined && { weeklyTarget: input.weeklyTarget }),
      ...(input.targetPeriod !== undefined && { targetPeriod: input.targetPeriod }),
      ...(input.targetUnit !== undefined && { targetUnit: input.targetUnit }),
      ...(input.targetValue !== undefined && { targetValue: input.targetValue }),
      ...(input.icon !== undefined && { icon: input.icon }),
      ...(input.position !== undefined && { position: input.position }),
      ...(input.archived !== undefined && { archived: input.archived }),
    },
  });

  return toCollection(row);
}

/** Hard delete. Items and progress cascade — this is not recoverable. */
export async function deleteCollection(userId: string, collectionId: string): Promise<void> {
  await requireOwnedCollection(userId, collectionId);
  await prisma.collection.delete({ where: { id: collectionId } });
}

/* ── Import ───────────────────────────────────────────────────────────────── */

export interface ImportResult {
  added: number;
  /** Rejected by the unique (collectionId, dedupeKey) index — already present. */
  skipped: number;
  total: number;
}

/**
 * Append items to a collection.
 *
 * Idempotent by construction: `createMany` with `skipDuplicates` leans on the
 * unique index over (collectionId, dedupeKey), so re-importing the same list
 * adds nothing. Items with a null dedupe key — hand-typed titles with no link —
 * always insert, because Postgres treats repeated NULLs as distinct and there
 * is genuinely no way to tell two such entries apart.
 */
export async function importItems(
  userId: string,
  collectionId: string,
  input: ImportItemsInput
): Promise<ImportResult> {
  await requireOwnedCollection(userId, collectionId);

  const existing = await prisma.item.findMany({
    where: { collectionId },
    select: { id: true, position: true },
  });

  // `insertAfter` slots the new items in mid-list rather than appending. Null
  // means the very start; omitted means append, which is the old behaviour and
  // what a bulk paste should still do.
  const inserting = input.insertAfter !== undefined;
  const base = inserting
    ? insertPositionAfter(existing, input.insertAfter ?? null)
    : (existing.reduce((max, i) => Math.max(max, i.position), -1) + 1);

  // Shift first, in the same transaction as the insert below, so the list is
  // never briefly holding two items at the same position.
  const shifts = inserting ? shiftForInsert(existing, base, input.items.length) : [];

  const data = input.items.map((item, index) => ({
    collectionId,
    title: item.title,
    url: item.url ?? null,
    kind: item.kind,
    externalId: item.externalId ?? null,
    dedupeKey: item.dedupeKey ?? dedupeKeyFor({ externalId: item.externalId, url: item.url }),
    difficulty: item.difficulty ?? null,
    topic: item.topic ?? null,
    durationSeconds: item.durationSeconds ?? null,
    position: item.position ?? base + index,
  }));

  // Interactive transaction so the shift and the insert land together. Between
  // the two statements the list would otherwise hold duplicate positions, and
  // position is the sort key.
  const created = await prisma.$transaction(async (tx) => {
    if (shifts.length > 0) {
      await tx.item.updateMany({
        where: { collectionId, id: { in: shifts.map((shift) => shift.id) } },
        // Every shifted row moves by the same amount, so one statement covers
        // them all rather than a query per row.
        data: { position: { increment: input.items.length } },
      });
    }
    return tx.item.createMany({ data, skipDuplicates: true });
  });

  return {
    added: created.count,
    skipped: data.length - created.count,
    total: data.length,
  };
}

export async function deleteItem(userId: string, itemId: string): Promise<void> {
  await requireOwnedItem(userId, itemId);
  await prisma.item.delete({ where: { id: itemId } });
}

/* ── Item progress ────────────────────────────────────────────────────────── */

/**
 * Upsert progress against one item.
 *
 * Field semantics mirror `upsertProgress` exactly, and they are load-bearing:
 *   - `mastery` present → deliberate practice. Bump `repeatCount`, stamp
 *     `lastPracticedAt`, which is what review scheduling reads.
 *   - `mastery` absent → a notes, companies or time-only write. Must not touch
 *     either, or saving a note would silently reset the review schedule.
 *   - `timeSeconds` → always additive and independent of the above.
 */
export async function upsertItemProgress(
  userId: string,
  itemId: string,
  input: UpsertItemProgressInput
): Promise<ItemRecord> {
  await requireOwnedItem(userId, itemId);

  const isPractice = input.mastery !== undefined;
  const now = new Date();
  const seconds = input.timeSeconds ?? 0;

  const row = await prisma.itemProgress.upsert({
    where: { userId_itemId: { userId, itemId } },
    update: {
      ...(isPractice && {
        mastery: input.mastery,
        repeatCount: { increment: 1 },
        lastPracticedAt: now,
        // Solving satisfies a manual review request. Clearing it here rather
        // than relying on the timestamp comparison keeps a stale flag from
        // outliving the review that answered it.
        flaggedForReviewAt: null,
      }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.companies !== undefined && { companies: input.companies }),
      ...(seconds > 0 && { totalTimeSeconds: { increment: seconds } }),
    },
    create: {
      userId,
      itemId,
      mastery: input.mastery ?? "unseen",
      notes: input.notes ?? null,
      companies: input.companies ?? [],
      repeatCount: isPractice ? 1 : 0,
      totalTimeSeconds: seconds,
      lastPracticedAt: isPractice ? now : null,
    },
  });

  return toItemRecord(row);
}

/* ── Ordering ─────────────────────────────────────────────────────────────── */

/**
 * Apply a manual reorder.
 *
 * Written in a single transaction: a half-applied reorder leaves two items
 * sharing a position, and since position is the sort key that shows up as rows
 * silently swapping on every render.
 *
 * Only ids belonging to this collection are touched. Anything else in the
 * payload is ignored rather than rejected — a stale tab holding a deleted id
 * should not fail the whole drag.
 */
export async function reorderItems(
  userId: string,
  collectionId: string,
  updates: readonly { id: string; position: number }[]
): Promise<void> {
  await requireOwnedCollection(userId, collectionId);
  if (updates.length === 0) return;

  const owned = new Set(
    (
      await prisma.item.findMany({
        where: { collectionId, id: { in: updates.map((u) => u.id) } },
        select: { id: true },
      })
    ).map((i) => i.id)
  );

  const applicable = updates.filter((u) => owned.has(u.id));
  if (applicable.length === 0) return;

  await prisma.$transaction(
    applicable.map((u) =>
      prisma.item.update({ where: { id: u.id }, data: { position: u.position } })
    )
  );
}

/* ── Revisions ────────────────────────────────────────────────────────────── */

/**
 * Record a revision: the item was gone back over without being re-solved.
 *
 * Deliberately does NOT touch `mastery` or `repeatCount`. Reading your notes is
 * not evidence that your grasp changed, and letting it bump the solve counters
 * would make the two metrics indistinguishable — which is the whole reason
 * revisions are tracked separately.
 *
 * It does push the review schedule out, because reviewing is exactly what the
 * schedule is asking for.
 */
export async function reviseItem(userId: string, itemId: string): Promise<ItemRecord> {
  await requireOwnedItem(userId, itemId);

  const row = await prisma.itemProgress.upsert({
    where: { userId_itemId: { userId, itemId } },
    update: {
      revisionCount: { increment: 1 },
      lastRevisedAt: new Date(),
      flaggedForReviewAt: null,
    },
    create: {
      userId,
      itemId,
      // An item revised before it was ever solved stays `unseen`: revising is
      // not a claim about mastery, and inventing one here would corrupt both
      // the dashboard counts and the review schedule.
      mastery: "unseen",
      revisionCount: 1,
      lastRevisedAt: new Date(),
    },
  });

  return toItemRecord(row);
}

/**
 * Flag an item for review, or clear the flag.
 *
 * Flagging stamps `flaggedForReviewAt`, which outranks the schedule until the
 * next practice or revision clears it.
 */
export async function setItemReviewFlag(
  userId: string,
  itemId: string,
  flagged: boolean
): Promise<ItemRecord> {
  await requireOwnedItem(userId, itemId);
  const flaggedForReviewAt = flagged ? new Date() : null;

  const row = await prisma.itemProgress.upsert({
    where: { userId_itemId: { userId, itemId } },
    update: { flaggedForReviewAt },
    create: { userId, itemId, mastery: "unseen", flaggedForReviewAt },
  });

  return toItemRecord(row);
}

/* ── Watch progress ───────────────────────────────────────────────────────── */

/**
 * Persist video watch progress.
 *
 * Written on a throttle from the player, so it must be cheap and must never
 * regress: `watchedSeconds` only ever moves forward, because a stale in-flight
 * request arriving late must not undo newer progress.
 *
 * Crossing the completion threshold is decided here rather than trusted from
 * the client, and promotes mastery to "familiar" — but only upward, so a video
 * the user already marked "mastered" is not demoted by a re-watch.
 */
export async function saveWatchProgress(
  userId: string,
  itemId: string,
  input: { watchedSeconds: number; positionSeconds: number }
): Promise<ItemRecord & { complete: boolean }> {
  const item = await requireOwnedItem(userId, itemId);

  const existing = await prisma.itemProgress.findUnique({
    where: { userId_itemId: { userId, itemId } },
  });

  const watchedSeconds = Math.max(existing?.watchedSeconds ?? 0, input.watchedSeconds);
  const duration = item.durationSeconds ?? null;
  const { complete } = describeWatch({ watchedSeconds, positionSeconds: input.positionSeconds }, duration);

  const alreadyRecorded = existing ? isSolved(toMasteryLevel(existing.mastery)) : false;
  const promote = complete && !alreadyRecorded;

  const row = await prisma.itemProgress.upsert({
    where: { userId_itemId: { userId, itemId } },
    update: {
      watchedSeconds,
      positionSeconds: input.positionSeconds,
      ...(promote && {
        mastery: "familiar",
        repeatCount: { increment: 1 },
        lastPracticedAt: new Date(),
      }),
    },
    create: {
      userId,
      itemId,
      watchedSeconds,
      positionSeconds: input.positionSeconds,
      mastery: promote ? "familiar" : "unseen",
      repeatCount: promote ? 1 : 0,
      lastPracticedAt: promote ? new Date() : null,
    },
  });

  return { ...toItemRecord(row), complete };
}
