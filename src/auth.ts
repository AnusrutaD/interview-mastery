import NextAuth, { type DefaultSession } from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/server/db/prisma";

/**
 * Teach TypeScript that our session carries a user id. Without this every
 * `session.user.id` read is an error, which is the main reason the codebase
 * was previously untyped around auth.
 */
declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

/**
 * next-auth v5 re-exports its JWT type from @auth/core, so the augmentation
 * must target that module rather than "next-auth/jwt".
 */
declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") return null;

        const user = await prisma.user.findUnique({ where: { email } });
        // No password means the account was created via OAuth only.
        if (!user?.password) return null;

        const valid = await bcrypt.compare(password, user.password);
        return valid ? user : null;
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) session.user.id = token.id;
      return session;
    },
  },
  pages: { signIn: "/login" },
});
