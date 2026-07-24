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
  const solved = mastered + familiar;

  // By difficulty
  const byDifficulty = ["Easy", "Medium", "Hard"].map(diff => {
    const set = enriched.filter(p => p.difficulty === diff);
    return {
      label: diff,
      total: set.length,
      solved: set.filter(p => p.mastery === "mastered" || p.mastery === "familiar").length,
      mastered: set.filter(p => p.mastery === "mastered").length,
    };
  });

  // By category
  const catMap = {};
  for (const p of enriched) {
    if (!catMap[p.category]) catMap[p.category] = { total: 0, solved: 0, mastered: 0 };
    catMap[p.category].total++;
    if (p.mastery === "mastered" || p.mastery === "familiar") catMap[p.category].solved++;
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

  return NextResponse.json({
    user,
    stats: { total, solved, mastered, familiar, learning, unseen },
    byDifficulty,
    byCategory,
    recent,
  });
}
