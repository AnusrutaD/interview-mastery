import "server-only";
import { auth } from "@/auth";
import { prisma } from "../db/prisma";

/**
 * Resolve the acting user from either authentication mechanism.
 *
 * Two callers exist: the web app (NextAuth session cookie) and the Chrome
 * extension running on leetcode.com, which cannot use cookies cross-origin and
 * instead presents an `x-api-key`.
 */
export async function resolveUserId(request?: Request): Promise<string | null> {
  const apiKey = request?.headers.get("x-api-key");
  if (apiKey) {
    const user = await prisma.user.findUnique({
      where: { apiKey },
      select: { id: true },
    });
    return user?.id ?? null;
  }

  const session = await auth();
  return session?.user?.id ?? null;
}

/** For server components, where only a session is possible. */
export async function requireSessionUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}
