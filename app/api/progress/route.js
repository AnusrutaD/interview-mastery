import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET /api/progress — load all progress for the logged-in user
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await prisma.progress.findMany({
    where: { userId: session.user.id },
    select: { problemId: true, mastery: true, notes: true },
  });

  // Convert to { progress: {id: level}, notes: {id: text} }
  const progress = {};
  const notes = {};
  for (const row of rows) {
    progress[row.problemId] = row.mastery;
    if (row.notes) notes[row.problemId] = row.notes;
  }

  return NextResponse.json({ progress, notes });
}

// POST /api/progress — upsert a single problem's progress
export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { problemId, mastery, notes } = await request.json();
  if (!problemId) {
    return NextResponse.json({ error: "problemId required" }, { status: 400 });
  }

  const row = await prisma.progress.upsert({
    where: { userId_problemId: { userId: session.user.id, problemId } },
    update: { ...(mastery !== undefined && { mastery }), ...(notes !== undefined && { notes }) },
    create: { userId: session.user.id, problemId, mastery: mastery ?? "unseen", notes: notes ?? null },
  });

  return NextResponse.json({ ok: true, row });
}
