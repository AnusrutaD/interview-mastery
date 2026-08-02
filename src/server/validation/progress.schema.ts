import { z } from "zod";
import { MASTERY_LEVELS } from "@/core/domain/mastery";

/** Upper bound on a single recorded session: 6h. Rejects clock-skew garbage. */
const MAX_SESSION_SECONDS = 6 * 60 * 60;

export const upsertProgressSchema = z
  .object({
    problemId: z.number().int().positive().optional(),
    /** LeetCode URL slug — the extension's identifier for a problem. */
    leetcodeSlug: z.string().min(1).optional(),
    mastery: z.enum(MASTERY_LEVELS).optional(),
    notes: z.string().max(50_000).nullable().optional(),
    companies: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
    timeSeconds: z.number().int().nonnegative().max(MAX_SESSION_SECONDS).optional(),
  })
  .refine((body) => body.problemId !== undefined || body.leetcodeSlug !== undefined, {
    message: "Either problemId or leetcodeSlug is required",
  })
  .refine(
    (body) =>
      body.mastery !== undefined ||
      body.notes !== undefined ||
      body.timeSeconds !== undefined ||
      body.companies !== undefined,
    { message: "Nothing to update: provide mastery, notes, companies or timeSeconds" }
  );

export type UpsertProgressInput = z.infer<typeof upsertProgressSchema>;

export const progressQuerySchema = z.object({
  category: z.string().optional(),
  /** Comma-separated problem ids, for scoped fetches. */
  ids: z
    .string()
    .optional()
    .transform((value) =>
      value
        ? value
            .split(",")
            .map((s) => Number.parseInt(s.trim(), 10))
            .filter((n) => Number.isInteger(n) && n > 0)
        : undefined
    ),
});

export const updateSettingsSchema = z.object({
  dailyGoal: z.number().int().min(1).max(50),
});
