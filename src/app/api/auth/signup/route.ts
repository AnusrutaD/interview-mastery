import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { registerUser } from "@/server/services/auth.service";
import { ApiError } from "@/server/http/handler";
import { signupSchema } from "@/server/validation/auth.schema";

/** Public route — no auth wrapper, but still validated and error-translated. */
export async function POST(request: Request) {
  try {
    const input = signupSchema.parse(await request.json());
    return NextResponse.json(await registerUser(input));
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[signup]", err);
    return NextResponse.json({ error: "Could not create account" }, { status: 500 });
  }
}
