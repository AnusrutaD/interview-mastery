import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "../db/prisma";
import { ApiError } from "../http/handler";

const BCRYPT_ROUNDS = 12;

export async function registerUser(input: { name: string; email: string; password: string }) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new ApiError(409, "Email already in use");

  const password = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: { name: input.name, email: input.email, password },
    select: { id: true, email: true },
  });
  return { ok: true as const, userId: user.id };
}

/**
 * Tells the login form whether an address can use password sign-in.
 *
 * Deliberately does NOT reveal whether an account exists — an unknown email and
 * a password-capable account return the same shape, so this cannot be used to
 * enumerate registered users.
 */
export async function describeSignInMethods(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { password: true, accounts: { select: { provider: true } } },
  });

  if (!user || user.password || user.accounts.length === 0) {
    return { oauthOnly: false };
  }
  return {
    oauthOnly: true,
    providers: user.accounts.map((a) => a.provider).join(", "),
  };
}
