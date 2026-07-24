import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { PROBLEMS } from "@/data/problems";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
};

// OPTIONS — preflight for Chrome extension
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// Resolve userId from session OR x-api-key header
async function resolveUserId(request) {
  // Try API key first (for Chrome extension)
  const apiKey = request.headers.get("x-api-key");
  if (apiKey) {
    const user = await prisma.user.findUnique({
      where: { apiKey },
      select: { id: true },
    });
    return user?.id || null;
  }
  // Fall back to session
  const session = await auth();
  return session?.user?.id || null;
}

// GET /api/progress — load all progress for the logged-in user
export async function GET(request) {
  const userId = await resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
  }

  const rows = await prisma.progress.findMany({
    where: { userId },
    select: { problemId: true, mastery: true, notes: true, updatedAt: true },
  });

  const progress = {};
  const notes = {};
  const updatedAt = {};
  for (const row of rows) {
    progress[row.problemId] = row.mastery;
    if (row.notes) notes[row.problemId] = row.notes;
    updatedAt[row.problemId] = row.updatedAt;
  }

  return NextResponse.json({ progress, notes, updatedAt }, { headers: CORS_HEADERS });
}

// POST /api/progress — upsert a single problem's progress
export async function POST(request) {
  const userId = await resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
  }

  const { problemId: rawId, leetcodeSlug, mastery, notes } = await request.json();

  let problemId = rawId;

  // If a LeetCode URL slug was provided, resolve it to the internal problem ID
  if (!problemId && leetcodeSlug) {
    const problem = PROBLEMS.find(p => p.url.includes(`/problems/${leetcodeSlug}/`));
    if (problem) {
      problemId = problem.id;
    } else {
      return NextResponse.json(
        { error: `Problem not found in NeetCode 150: ${leetcodeSlug}` },
        { status: 404, headers: CORS_HEADERS }
      );
    }
  }

  if (problemId == null) {
    return NextResponse.json({ error: "problemId or leetcodeSlug required" }, { status: 400, headers: CORS_HEADERS });
  }

  const row = await prisma.progress.upsert({
    where: { userId_problemId: { userId, problemId } },
    update: { ...(mastery !== undefined && { mastery }), ...(notes !== undefined && { notes }) },
    create: { userId, problemId, mastery: mastery ?? "unseen", notes: notes ?? null },
  });

  return NextResponse.json({ ok: true, row }, { headers: CORS_HEADERS });
}
