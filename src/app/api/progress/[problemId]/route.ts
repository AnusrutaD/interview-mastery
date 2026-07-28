import { getProgress } from "@/server/services/progress.service";
import { ApiError, preflight, withAuth } from "@/server/http/handler";
import { EMPTY_PROGRESS } from "@/core/domain/progress";
import { getProblemById } from "@/data/problems";

export const OPTIONS = preflight;

/**
 * GET /api/progress/[problemId]
 * Single-record fetch for the problem detail page, which previously pulled the
 * entire 150-problem progress map to render one problem.
 */
export const GET = withAuth<{ problemId: string }>(async ({ userId, params }) => {
  const problemId = Number.parseInt(params.problemId, 10);
  if (!Number.isInteger(problemId) || !getProblemById(problemId)) {
    throw ApiError.notFound(`Unknown problem id: ${params.problemId}`);
  }
  const progress = await getProgress(userId, problemId);
  return { progress: progress ?? EMPTY_PROGRESS };
});
