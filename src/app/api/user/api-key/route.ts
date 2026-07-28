import { getApiKey, rotateApiKey } from "@/server/services/user.service";
import { withAuth } from "@/server/http/handler";

export const GET = withAuth(({ userId }) => getApiKey(userId));

/** POST regenerates the key, invalidating the previous one. */
export const POST = withAuth(({ userId }) => rotateApiKey(userId));
