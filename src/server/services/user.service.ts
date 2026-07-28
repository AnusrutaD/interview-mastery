import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "../db/prisma";

export const DEFAULT_DAILY_GOAL = 3;

export async function getSettings(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { dailyGoal: true },
  });
  return { dailyGoal: user?.dailyGoal ?? DEFAULT_DAILY_GOAL };
}

export async function updateSettings(userId: string, dailyGoal: number) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { dailyGoal },
    select: { dailyGoal: true },
  });
  return { dailyGoal: user.dailyGoal };
}

export async function getApiKey(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { apiKey: true },
  });
  return { apiKey: user?.apiKey ?? null };
}

/**
 * Issue a new API key for the Chrome extension.
 * 32 random bytes, hex encoded — regenerating invalidates the previous key.
 */
export async function rotateApiKey(userId: string) {
  const apiKey = randomBytes(32).toString("hex");
  await prisma.user.update({ where: { id: userId }, data: { apiKey } });
  return { apiKey };
}
