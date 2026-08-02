import { z } from "zod";
import { MASTERY_LEVELS } from "@/core/domain/mastery";
import { STUDY_ITEM_TYPES } from "@/core/domain/systemDesign";

export const upsertStudyProgressSchema = z
  .object({
    itemType: z.enum(STUDY_ITEM_TYPES),
    itemSlug: z.string().min(1).max(120),
    mastery: z.enum(MASTERY_LEVELS).optional(),
    notes: z.string().max(100_000).nullable().optional(),
    timeSeconds: z.number().int().nonnegative().max(6 * 60 * 60).optional(),
    quiz: z
      .object({
        score: z.number().int().nonnegative(),
        total: z.number().int().positive(),
      })
      .optional(),
    rubric: z
      .object({
        checked: z.array(z.string().min(1)).max(200),
        score: z.number().int().nonnegative(),
        max: z.number().int().nonnegative(),
      })
      .optional(),
  })
  .refine(
    (b) =>
      b.mastery !== undefined ||
      b.notes !== undefined ||
      b.timeSeconds !== undefined ||
      b.quiz !== undefined ||
      b.rubric !== undefined,
    { message: "Nothing to update" }
  );

export type UpsertStudyProgressInput = z.infer<typeof upsertStudyProgressSchema>;
