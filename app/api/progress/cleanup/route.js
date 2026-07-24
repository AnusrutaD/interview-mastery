import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PROBLEMS } from "@/data/problems";
import { NextResponse } from "next/server";

// DELETE /api/progress/cleanup
// Removes orphaned progress rows with invalid problemIds (outside 1–150 range)
// Only the authenticated user can clean up their own data
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const validIds = PROBLEMS.map(p => p.id);

  const result = await prisma.progress.deleteMany({
    where: {
      userId: session.user.id,
      problemId: { notIn: validIds },
    },
  });

  return NextResponse.json({ deleted: result.count });
}
