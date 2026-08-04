// Deliberately still the legacy service, unlike the other progress routes.
// This endpoint exists to delete `Progress` rows whose problemId left the
// catalogue; the collection model cannot produce that state, so pointing it at
// dsaProgress.service would turn it into a silent no-op rather than migrating
// it. It retires when `Progress` is dropped.
import { pruneOrphanedProgress } from "@/server/services/progress.service";
import { withAuth } from "@/server/http/handler";

/** POST /api/progress/cleanup — remove rows for problems no longer in the set. */
export const POST = withAuth(async ({ userId }) => ({
  deleted: await pruneOrphanedProgress(userId),
}));
