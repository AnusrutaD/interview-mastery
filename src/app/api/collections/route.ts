import { createCollection, listCollections } from "@/server/services/collection.service";
import { parseBody, withAuth } from "@/server/http/handler";
import { createCollectionSchema } from "@/server/validation/collection.schema";

/** GET /api/collections — the user's lists, with item and completion counts. */
export const GET = withAuth(async ({ userId, request }) => {
  const includeArchived = new URL(request.url).searchParams.get("archived") === "true";
  return { collections: await listCollections(userId, { includeArchived }) };
});

/** POST /api/collections — create an empty list. */
export const POST = withAuth(async ({ userId, request }) => {
  const input = await parseBody(request, createCollectionSchema);
  return { collection: await createCollection(userId, input) };
});
