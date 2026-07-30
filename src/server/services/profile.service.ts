import "server-only";
import { isSolved } from "@/core/domain/mastery";
import { calculateStreak, joinProgress, summarize } from "@/core/domain/progress";
import { PROBLEMS } from "@/data/problems";
import { prisma } from "../db/prisma";
import { listProgress } from "./progress.service";

export interface CategoryBreakdown {
  name: string;
  total: number;
  attempted: number;
  mastered: number;
}

/**
 * Aggregate profile view. Built on the same `summarize`/`calculateStreak`
 * helpers the client uses, so server and client can never disagree about
 * what "attempted today" or "streak" means.
 */
export async function getProfile(userId: string) {
  const [user, progress] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, image: true, dailyGoal: true },
    }),
    listProgress(userId),
  ]);

  const problems = joinProgress(PROBLEMS, progress);
  const stats = summarize(problems);

  // Streaks count solves, not failed attempts.
  const practiceTimestamps = problems
    .filter((p) => isSolved(p.mastery) && p.lastMasteryAt)
    .map((p) => p.lastMasteryAt!);
  const streak = calculateStreak(practiceTimestamps);

  const categoryMap = new Map<string, CategoryBreakdown>();
  for (const p of problems) {
    const entry = categoryMap.get(p.category) ?? {
      name: p.category,
      total: 0,
      attempted: 0,
      mastered: 0,
    };
    entry.total += 1;
    if (p.mastery !== "unseen") entry.attempted += 1;
    if (p.mastery === "mastered") entry.mastered += 1;
    categoryMap.set(p.category, entry);
  }

  const byCategory = [...categoryMap.values()].sort(
    (a, b) => b.attempted / b.total - a.attempted / a.total
  );

  const byDifficulty = (["Easy", "Medium", "Hard"] as const).map((label) => ({
    label,
    total: stats.byDifficulty[label].total,
    attempted: stats.byDifficulty[label].attempted,
    mastered: problems.filter((p) => p.difficulty === label && p.mastery === "mastered").length,
  }));

  const recent = problems
    .filter((p) => p.lastMasteryAt)
    .sort((a, b) => new Date(b.lastMasteryAt!).getTime() - new Date(a.lastMasteryAt!).getTime())
    .slice(0, 10)
    .map((p) => ({
      id: p.id,
      title: p.title,
      difficulty: p.difficulty,
      mastery: p.mastery,
      lastMasteryAt: p.lastMasteryAt,
    }));

  return {
    user,
    stats: {
      total: stats.total,
      attempted: stats.attempted,
      solved: stats.solved,
      unsolved: stats.byMastery.unsolved,
      mastered: stats.byMastery.mastered,
      familiar: stats.byMastery.familiar,
      learning: stats.byMastery.learning,
      unseen: stats.byMastery.unseen,
      due: stats.due,
      solvedToday: stats.solvedToday,
      totalTimeSeconds: stats.totalTimeSeconds,
      streak,
    },
    byDifficulty,
    byCategory,
    recent,
    dailyGoal: user?.dailyGoal ?? 3,
  };
}

export type ProfilePayload = Awaited<ReturnType<typeof getProfile>>;
