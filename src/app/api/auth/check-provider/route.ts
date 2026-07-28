import { NextResponse } from "next/server";
import { describeSignInMethods } from "@/server/services/auth.service";
import { checkProviderSchema } from "@/server/validation/auth.schema";

export async function POST(request: Request) {
  const parsed = checkProviderSchema.safeParse(await request.json().catch(() => null));
  // Invalid input reveals nothing — same neutral response as an unknown email.
  if (!parsed.success) return NextResponse.json({ oauthOnly: false });
  return NextResponse.json(await describeSignInMethods(parsed.data.email));
}
