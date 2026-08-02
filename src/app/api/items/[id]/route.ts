import { deleteItem } from "@/server/services/collection.service";
import { withAuth } from "@/server/http/handler";

export const DELETE = withAuth<{ id: string }>(async ({ userId, params }) => {
  await deleteItem(userId, params.id);
  return { deleted: true };
});
