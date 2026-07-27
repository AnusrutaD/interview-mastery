import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PROBLEMS } from "@/data/problems";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, image: true },
  });

  const progressRows = await prisma.progress.findMany({
    where: { userId: session.user.id },
    select: { problemId: true, mastery: true, updatedAt: true, notes: true },
  });

  const progressMap = {};
  for (const row of progressRows) {
    progressMap[row.problemId] = row;
  }

  // Enrich problems with mastery
  const enriched = PROBLEMS.map(p => ({
    ...p,
    mastery: progressMap[p.id]?.mastery || "unseen",
    updatedAt: progressMap[p.id]?.updatedAt || null,
    hasNotes: !!(progressMap[p.id]?.notes?.trim()),
  }));

  // Overall stats
  const total = enriched.length;
  const mastered = enriched.filter(p => p.mastery === "mastered").length;
  const familiar = enriched.filter(p => p.mastery === "familiar").length;
  const learning = enriched.filter(p => p.mastery === "learning").length;
  const unseen = enriched.filter(p => p.mastery === "unseen").length;
  // "attempted" = any non-unseen (learning + familiar + mastered) — drives the donut and topic bars
  const attempted = mastered + familiar + learning;
  // "solved" kept for backward compat (familiar + mastered) — shown separately if needed
  const solved = mastered + familiar;

  // By difficulty
  const byDifficulty = ["Easy", "Medium", "Hard"].map(diff => {
    const set = enriched.filter(p => p.difficulty === diff);
    return {
      label: diff,
      total: set.length,
      solved: set.filter(p => p.mastery !== "unseen").length,
      mastered: set.filter(p => p.mastery === "mastered").length,
    };
  });

  // By category
  const catMap = {};
  for (const p of enriched) {
    if (!catMap[p.category]) catMap[p.category] = { total: 0, solved: 0, mastered: 0 };
    catMap[p.category].total++;
    if (p.mastery !== "unseen") catMap[p.category].solved++;
    if (p.mastery === "mastered") catMap[p.category].mastered++;
  }
  const byCategory = Object.entries(catMap)
    .map(([name, s]) => ({ name, ...s }))
    .sort((a, b) => b.solved / b.total - a.solved / a.total);

  // Recent activity (last 10 touched problems)
  const recent = enriched
    .filter(p => p.updatedAt)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 10)
    .map(p => ({ id: p.id, title: p.title, difficulty: p.difficulty, mastery: p.mastery, updatedAt: p.updatedAt }));

  // Only count rows with valid internal problem IDs (1–150)
  // Rows outside this range are orphans from the old extension bug (sent LeetCode numbers)
  const validProblemIds = new Set(PROBLEMS.map(p => p.id));
  const validRows = progressRows.filter(r => validProblemIds.has(r.problemId));

  // solvedToday is computed client-side using browser timezone.
  // Keep a UTC-based fallback here for server-rendered contexts.
  const todayStartUTC = new Date();
  todayStartUTC.setUTCHours(0, 0, 0, 0);
  const solvedToday = validRows.filter(
    r => r.mastery !== "unseen" && new Date(r.updatedAt) >= todayStartUTC
  ).length;

  // Streak — consecutive days with at least one solve (uses updatedAt as proxy)
  const solveDays = new Set(
    validRows
      .filter(r => r.mastery !== "unseen")
      .map(r => {
        const d = new Date(r.updatedAt);
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      })
  );

  function dayKey(date) {
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  }

  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  // If nothing solved today, start streak check from yesterday
  if (!solveDays.has(dayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (solveDays.has(dayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return NextResponse.json({
    user,
    stats: { total, attempted, solved, mastered, familiar, learning, unseen, solvedToday, streak },
    byDifficulty,
    byCategory,
    recent,
  });
}
