import { reviseProblem, setProblemReviewFlag } from "@/server/services/dsaProgress.service";
import { parseBody, preflight, withAuth } from "@/server/http/handler";
import { flagProblemSchema, reviseProblemSchema } from "@/server/validation/progress.schema";

export const OPTIONS = preflight;

/**
 * POST /api/progress/revise
 *
 * Records a revision: the problem was gone back over without being re-solved.
 * Deliberately a separate endpoint from the mastery upsert — routing it through
 * there would mean revising bumped the solve counters, which is exactly the
 * conflation this feature exists to avoid.
 */
export const POST = withAuth(async ({ userId, request }) => {
  const input = await parseBody(request, reviseProblemSchema);
  return { progress: await reviseProblem(userId, input.problemId) };
});

/** PATCH /api/progress/revise — set or clear the manual review flag. */
export const PATCH = withAuth(async ({ userId, request }) => {
  const input = await parseBody(request, flagProblemSchema);
  return { progress: await setProblemReviewFlag(userId, input.problemId, input.flagged) };
});
