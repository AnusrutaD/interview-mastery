import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(request) {
  const { email } = await request.json();
  if (!email) return NextResponse.json({});

  const user = await prisma.user.findUnique({
    where: { email },
    include: { accounts: true },
  });

  if (!user) return NextResponse.json({});

  if (!user.password && user.accounts.length > 0) {
    const providers = user.accounts.map(a => a.provider).join(", ");
    return NextResponse.json({ oauthOnly: true, providers });
  }

  return NextResponse.json({ oauthOnly: false });
}
