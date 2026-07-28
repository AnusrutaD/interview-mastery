import { getSettings, updateSettings } from "@/server/services/user.service";
import { parseBody, withAuth } from "@/server/http/handler";
import { updateSettingsSchema } from "@/server/validation/progress.schema";

export const GET = withAuth(({ userId }) => getSettings(userId));

const update = withAuth(async ({ userId, request }) => {
  const { dailyGoal } = await parseBody(request, updateSettingsSchema);
  return updateSettings(userId, dailyGoal);
});

// Both verbs accepted: PATCH is semantically correct, POST kept for
// compatibility with existing clients.
export const PATCH = update;
export const POST = update;
