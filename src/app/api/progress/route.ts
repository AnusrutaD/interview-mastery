import { listProgress, upsertProgress } from "@/server/services/progress.service";
import { parseBody, preflight, withAuth } from "@/server/http/handler";
import {
  progressQuerySchema,
  upsertProgressSchema,
} from "@/server/validation/progress.schema";

export const OPTIONS = preflight;

/**
 * GET /api/progress
 * Optional scoping: ?category=Trees or ?ids=1,2,3
 * Unscoped returns the full map (dashboard); scoped avoids shipping all 150
 * records to pages that only render a subset.
 */
export const GET = withAuth(async ({ userId, request }) => {
  const url = new URL(request.url);
  const query = progressQuerySchema.parse({
    category: url.searchParams.get("category") ?? undefined,
    ids: url.searchParams.get("ids") ?? undefined,
  });

  const progress = await listProgress(userId, {
    category: query.category,
    ids: query.ids,
  });

  return { progress };
});

/** POST /api/progress — upsert mastery, notes and/or elapsed time. */
export const POST = withAuth(async ({ userId, request }) => {
  const input = await parseBody(request, upsertProgressSchema);
  const record = await upsertProgress(userId, input);
  return { progress: record };
});
