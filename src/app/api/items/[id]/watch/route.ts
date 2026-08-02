import { saveWatchProgress } from "@/server/services/collection.service";
import { parseBody, withAuth } from "@/server/http/handler";
import { watchProgressSchema } from "@/server/validation/collection.schema";

/**
 * POST /api/items/[id]/watch — throttled progress ping from the player.
 *
 * Completion is decided server-side from the stored duration, never trusted
 * from the client.
 */
export const POST = withAuth<{ id: string }>(async ({ userId, request, params }) => {
  const input = await parseBody(request, watchProgressSchema);
  return { progress: await saveWatchProgress(userId, params.id, input) };
});
