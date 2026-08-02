import {
  deleteCollection,
  getCollection,
  updateCollection,
} from "@/server/services/collection.service";
import { parseBody, withAuth } from "@/server/http/handler";
import { updateCollectionSchema } from "@/server/validation/collection.schema";

type Params = { id: string };

/** GET — collection with its items and the user's progress against them. */
export const GET = withAuth<Params>(({ userId, params }) => getCollection(userId, params.id));

export const PATCH = withAuth<Params>(async ({ userId, request, params }) => {
  const input = await parseBody(request, updateCollectionSchema);
  return { collection: await updateCollection(userId, params.id, input) };
});

/** DELETE — removes items and progress by cascade. Not recoverable. */
export const DELETE = withAuth<Params>(async ({ userId, params }) => {
  await deleteCollection(userId, params.id);
  return { deleted: true };
});
