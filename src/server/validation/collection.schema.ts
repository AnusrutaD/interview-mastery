import { z } from "zod";
import { COLLECTION_SOURCES, ITEM_KINDS } from "@/core/domain/collection";
import { TARGET_PERIODS, TARGET_UNITS } from "@/core/domain/target";
import { MASTERY_LEVELS } from "@/core/domain/mastery";

const MAX_SESSION_SECONDS = 6 * 60 * 60;
/** Guards a single paste from becoming an accidental denial-of-service. */
export const MAX_IMPORT_ITEMS = 2000;

export const createCollectionSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).nullable().optional(),
  source: z.enum(COLLECTION_SOURCES).default("manual"),
  sourceUrl: z.string().trim().url().max(2000).nullable().optional(),
  dailyTarget: z.number().int().min(1).max(100).nullable().optional(),
  weeklyTarget: z.number().int().min(1).max(500).nullable().optional(),
  targetPeriod: z.enum(TARGET_PERIODS).nullable().optional(),
  targetUnit: z.enum(TARGET_UNITS).nullable().optional(),
  targetValue: z.number().int().min(1).max(10_000).nullable().optional(),
  icon: z.string().trim().max(8).nullable().optional(),
});

export const updateCollectionSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    sourceUrl: z.string().trim().url().max(2000).nullable().optional(),
    // Explicit null means "stop pacing this list" — distinct from omitting the
    // field, which leaves the existing target alone.
    dailyTarget: z.number().int().min(1).max(100).nullable().optional(),
    weeklyTarget: z.number().int().min(1).max(500).nullable().optional(),
    targetPeriod: z.enum(TARGET_PERIODS).nullable().optional(),
    targetUnit: z.enum(TARGET_UNITS).nullable().optional(),
    targetValue: z.number().int().min(1).max(10_000).nullable().optional(),
    icon: z.string().trim().max(8).nullable().optional(),
    position: z.number().int().min(0).max(1000).optional(),
    archived: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: "Nothing to update" });

export const importItemSchema = z.object({
  title: z.string().trim().min(1).max(300),
  url: z.string().trim().max(2000).nullable().optional(),
  kind: z.enum(ITEM_KINDS).default("problem"),
  externalId: z.string().trim().max(200).nullable().optional(),
  dedupeKey: z.string().trim().max(2000).nullable().optional(),
  difficulty: z.string().trim().max(40).nullable().optional(),
  topic: z.string().trim().max(120).nullable().optional(),
  /** Runtime in seconds. Capped at 12h — longer is bad metadata, not a lecture. */
  durationSeconds: z.number().int().positive().max(43_200).nullable().optional(),
  position: z.number().int().min(0).optional(),
});

export const importItemsSchema = z.object({
  items: z.array(importItemSchema).min(1).max(MAX_IMPORT_ITEMS),
  /**
   * Slot the new items in after this item id. `null` means the very start.
   * Omitting the field appends, which is what a bulk paste should do.
   */
  insertAfter: z.string().nullable().optional(),
});

/** Raw paste — parsed server-side so the client and API agree on the rules. */
export const importTextSchema = z.object({
  text: z.string().min(1).max(500_000),
  insertAfter: z.string().nullable().optional(),
});

export const upsertItemProgressSchema = z
  .object({
    mastery: z.enum(MASTERY_LEVELS).optional(),
    notes: z.string().max(100_000).nullable().optional(),
    companies: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
    timeSeconds: z.number().int().nonnegative().max(MAX_SESSION_SECONDS).optional(),
  })
  .refine(
    (body) =>
      body.mastery !== undefined ||
      body.notes !== undefined ||
      body.companies !== undefined ||
      body.timeSeconds !== undefined,
    { message: "Nothing to update" }
  );

export const watchProgressSchema = z.object({
  watchedSeconds: z.number().int().nonnegative().max(43_200),
  positionSeconds: z.number().int().nonnegative().max(43_200),
});

export type WatchProgressInput = z.infer<typeof watchProgressSchema>;

export const importPlaylistSchema = z.object({
  url: z.string().trim().min(5).max(2000),
});

export type CreateCollectionInput = z.infer<typeof createCollectionSchema>;
export type UpdateCollectionInput = z.infer<typeof updateCollectionSchema>;
export type ImportItemsInput = z.infer<typeof importItemsSchema>;
export type UpsertItemProgressInput = z.infer<typeof upsertItemProgressSchema>;

/** Body for PATCH on an item's revise route. */
export const flagItemSchema = z.object({ flagged: z.boolean() });

export type FlagItemInput = z.infer<typeof flagItemSchema>;

/** Body for PATCH /api/collections/[id]/order. */
export const reorderItemsSchema = z.object({
  updates: z
    .array(z.object({ id: z.string().min(1), position: z.number().int().min(0).max(100_000) }))
    .max(MAX_IMPORT_ITEMS),
});

export type ReorderItemsInput = z.infer<typeof reorderItemsSchema>;
