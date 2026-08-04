import { reorderItems } from "@/server/services/collection.service";
import { parseBody, preflight, withAuth } from "@/server/http/handler";
import { reorderItemsSchema } from "@/server/validation/collection.schema";

export const OPTIONS = preflight;

/**
 * PATCH /api/collections/[id]/order
 *
 * Takes the full set of changed positions rather than a from/to pair. The
 * client already computed the resulting order to render the drag, so sending
 * that is both cheaper and impossible to disagree with — a from/to pair would
 * have to be re-resolved server-side against a list that may have shifted.
 */
export const PATCH = withAuth<{ id: string }>(async ({ userId, params, request }) => {
  const { updates } = await parseBody(request, reorderItemsSchema);
  await reorderItems(userId, params.id, updates);
  return { ok: true, updated: updates.length };
});
