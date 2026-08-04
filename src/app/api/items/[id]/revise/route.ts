import { reviseItem, setItemReviewFlag } from "@/server/services/collection.service";
import { parseBody, preflight, withAuth } from "@/server/http/handler";
import { flagItemSchema } from "@/server/validation/collection.schema";

export const OPTIONS = preflight;

/**
 * POST /api/items/[id]/revise
 *
 * Records a revision: the item was gone back over without being re-solved.
 * Deliberately a separate endpoint from the progress upsert — routing it
 * through there would mean revising bumped the solve counters, which is the
 * conflation this feature exists to avoid.
 */
export const POST = withAuth<{ id: string }>(async ({ userId, params }) => ({
  progress: await reviseItem(userId, params.id),
}));

/** PATCH /api/items/[id]/revise — set or clear the manual review flag. */
export const PATCH = withAuth<{ id: string }>(async ({ userId, params, request }) => {
  const input = await parseBody(request, flagItemSchema);
  return { progress: await setItemReviewFlag(userId, params.id, input.flagged) };
});
