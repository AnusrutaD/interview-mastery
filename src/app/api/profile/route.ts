import { getProfile } from "@/server/services/profile.service";
import { withAuth } from "@/server/http/handler";

export const GET = withAuth(({ userId }) => getProfile(userId));
