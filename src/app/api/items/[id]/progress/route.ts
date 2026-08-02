import { upsertItemProgress } from "@/server/services/collection.service";
import { parseBody, withAuth } from "@/server/http/handler";
import { upsertItemProgressSchema } from "@/server/validation/collection.schema";

/** POST /api/items/[id]/progress — record mastery, notes, companies or time. */
export const POST = withAuth<{ id: string }>(async ({ userId, request, params }) => {
  const input = await parseBody(request, upsertItemProgressSchema);
  return { progress: await upsertItemProgress(userId, params.id, input) };
});
