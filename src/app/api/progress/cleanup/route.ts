import { pruneOrphanedProgress } from "@/server/services/progress.service";
import { withAuth } from "@/server/http/handler";

/** POST /api/progress/cleanup — remove rows for problems no longer in the set. */
export const POST = withAuth(async ({ userId }) => ({
  deleted: await pruneOrphanedProgress(userId),
}));
