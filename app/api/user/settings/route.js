import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { dailyGoal: true },
  });

  return NextResponse.json({ dailyGoal: user?.dailyGoal ?? 3 });
}

export async function PATCH(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { dailyGoal } = await request.json();
  if (!Number.isInteger(dailyGoal) || dailyGoal < 1 || dailyGoal > 20) {
    return NextResponse.json({ error: "dailyGoal must be an integer between 1 and 20" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { dailyGoal },
    select: { dailyGoal: true },
  });

  return NextResponse.json({ dailyGoal: user.dailyGoal });
}
