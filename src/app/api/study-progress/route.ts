import { listStudyProgress, upsertStudyProgress } from "@/server/services/study.service";
import { parseBody, withAuth } from "@/server/http/handler";
import { upsertStudyProgressSchema } from "@/server/validation/study.schema";

/** GET /api/study-progress — all system-design progress for the user. */
export const GET = withAuth(async ({ userId }) => ({
  progress: await listStudyProgress(userId),
}));

/** POST /api/study-progress — record mastery, notes, time, quiz or rubric. */
export const POST = withAuth(async ({ userId, request }) => {
  const input = await parseBody(request, upsertStudyProgressSchema);
  return { progress: await upsertStudyProgress(userId, input) };
});
