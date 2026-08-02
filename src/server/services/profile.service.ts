import "server-only";
import { isSolved, type MasteryLevel } from "@/core/domain/mastery";
import { calculateStreak, joinProgress, summarize } from "@/core/domain/progress";
import { isDue } from "@/core/domain/review";
import { isISTToday } from "@/core/time/ist";
import { PROBLEMS } from "@/data/problems";
import { getAllStudyItems } from "../content/studyContent";
import { prisma } from "../db/prisma";
import { listProgress } from "./progress.service";
import { listStudyProgress } from "./study.service";

export interface CategoryBreakdown {
  name: string;
  total: number;
  attempted: number;
  mastered: number;
}

export interface RecentEntry {
  /** Which track this came from — the profile shows a merged timeline. */
  track: "dsa" | "system-design";
  href: string;
  title: string;
  mastery: MasteryLevel;
  /** "Easy" | "Medium" | "Hard" for DSA; the pattern name for system design. */
  tag: string;
  at: string;
}

/**
 * Aggregate profile across both study tracks.
 *
 * Per-track stats stay separate because the two are not comparable — 150 coding
 * problems and 10 design items would produce a meaningless combined percentage.
 * What *is* combined is the behavioural data: streak, time invested, and
 * everything due today, since those answer "did I show up" regardless of track.
 */
export async function getProfile(userId: string) {
  const [user, dsaProgress, studyProgress] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, image: true, dailyGoal: true },
    }),
    listProgress(userId),
    listStudyProgress(userId),
  ]);

  /* ── DSA ──────────────────────────────────────────────────────────────── */

  const problems = joinProgress(PROBLEMS, dsaProgress);
  const dsaStats = summarize(problems);

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
    total: dsaStats.byDifficulty[label].total,
    attempted: dsaStats.byDifficulty[label].attempted,
    mastered: problems.filter((p) => p.difficulty === label && p.mastery === "mastered").length,
  }));

  /* ── System design ────────────────────────────────────────────────────── */

  const items = getAllStudyItems();

  let sdStudied = 0;
  let sdDue = 0;
  let sdToday = 0;
  let sdTime = 0;
  let quizPercentSum = 0;
  let quizCount = 0;
  let rubricPercentSum = 0;
  let rubricCount = 0;

  const patternMap = new Map<string, { name: string; total: number; studied: number }>();

  for (const item of items) {
    const entry = patternMap.get(item.pattern) ?? { name: item.pattern, total: 0, studied: 0 };
    entry.total += 1;

    const record = studyProgress[item.slug];
    if (record) {
      if (isSolved(record.mastery)) {
        sdStudied += 1;
        entry.studied += 1;
        if (record.lastMasteryAt && isISTToday(record.lastMasteryAt)) sdToday += 1;
      }
      if (isDue(record.mastery, record.lastMasteryAt)) sdDue += 1;
      sdTime += record.totalTimeSeconds;

      if (record.quizBestScore !== null && record.quizTotal) {
        quizPercentSum += (record.quizBestScore / record.quizTotal) * 100;
        quizCount += 1;
      }
      if (record.rubricScore !== null && record.rubricMax) {
        rubricPercentSum += (record.rubricScore / record.rubricMax) * 100;
        rubricCount += 1;
      }
    }

    patternMap.set(item.pattern, entry);
  }

  const systemDesign = {
    total: items.length,
    studied: sdStudied,
    due: sdDue,
    studiedToday: sdToday,
    totalTimeSeconds: sdTime,
    concepts: items.filter((i) => i.type === "concept").length,
    exercises: items.filter((i) => i.type === "exercise").length,
    /** null rather than 0 when nothing has been attempted — "no data" ≠ "scored 0". */
    averageQuizPercent: quizCount > 0 ? Math.round(quizPercentSum / quizCount) : null,
    quizzesTaken: quizCount,
    averageRubricPercent: rubricCount > 0 ? Math.round(rubricPercentSum / rubricCount) : null,
    exercisesScored: rubricCount,
    completionPercent: items.length ? Math.round((sdStudied / items.length) * 100) : 0,
    byPattern: [...patternMap.values()].sort(
      (a, b) => b.studied / b.total - a.studied / a.total
    ),
  };

  /* ── Combined behaviour ───────────────────────────────────────────────── */

  // Streaks count solves, not failed attempts, and span both tracks: showing up
  // for system design is showing up.
  const practiceTimestamps = [
    ...problems.filter((p) => isSolved(p.mastery) && p.lastMasteryAt).map((p) => p.lastMasteryAt!),
    ...Object.values(studyProgress)
      .filter((r) => isSolved(r.mastery) && r.lastMasteryAt)
      .map((r) => r.lastMasteryAt!),
  ];

  const itemBySlug = new Map(items.map((i) => [i.slug, i]));

  const recent: RecentEntry[] = [
    ...problems
      .filter((p) => p.lastMasteryAt)
      .map<RecentEntry>((p) => ({
        track: "dsa",
        href: `/problems/${p.id}`,
        title: p.title,
        mastery: p.mastery,
        tag: p.difficulty,
        at: p.lastMasteryAt!,
      })),
    ...Object.values(studyProgress)
      .filter((r) => r.lastMasteryAt && itemBySlug.has(r.itemSlug))
      .map<RecentEntry>((r) => ({
        track: "system-design",
        href: `/system-design/${r.itemSlug}`,
        title: itemBySlug.get(r.itemSlug)!.title,
        mastery: r.mastery,
        tag: itemBySlug.get(r.itemSlug)!.pattern,
        at: r.lastMasteryAt!,
      })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 12);

  return {
    user,
    dailyGoal: user?.dailyGoal ?? 3,

    combined: {
      streak: calculateStreak(practiceTimestamps),
      due: dsaStats.due + sdDue,
      totalTimeSeconds: dsaStats.totalTimeSeconds + sdTime,
      /** Daily goal is DSA-scoped; system design is reported alongside, not merged. */
      dsaSolvedToday: dsaStats.solvedToday,
      sdStudiedToday: sdToday,
    },

    dsa: {
      stats: {
        total: dsaStats.total,
        attempted: dsaStats.attempted,
        solved: dsaStats.solved,
        unsolved: dsaStats.byMastery.unsolved,
        mastered: dsaStats.byMastery.mastered,
        familiar: dsaStats.byMastery.familiar,
        learning: dsaStats.byMastery.learning,
        unseen: dsaStats.byMastery.unseen,
        due: dsaStats.due,
        solvedToday: dsaStats.solvedToday,
        totalTimeSeconds: dsaStats.totalTimeSeconds,
        completionPercent: dsaStats.completionPercent,
      },
      byDifficulty,
      byCategory,
    },

    systemDesign,
    recent,
  };
}

export type ProfilePayload = Awaited<ReturnType<typeof getProfile>>;
