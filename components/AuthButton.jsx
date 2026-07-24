"use client";
import { useSession, signIn, signOut } from "next-auth/react";
import Link from "next/link";

export default function AuthButton() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />;
  }

  if (session?.user) {
    const initials = (session.user.name || session.user.email || "?")
      .split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

    return (
      <div className="flex items-center gap-2">
        <Link href="/profile" className="flex items-center gap-2 group">
          {session.user.image ? (
            <img
              src={session.user.image}
              alt={session.user.name || "User"}
              className="w-8 h-8 rounded-full border-2 border-transparent group-hover:border-blue-400 transition-colors"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold border-2 border-transparent group-hover:border-blue-400 transition-colors">
              {initials}
            </div>
          )}
          <div className="hidden sm:block text-left">
            <p className="text-xs font-medium text-gray-700 leading-tight group-hover:text-blue-600 transition-colors">
              {session.user.name || session.user.email}
            </p>
            <p className="text-xs text-gray-400">View profile</p>
          </div>
        </Link>
        <button
          onClick={() => signOut()}
          className="text-xs text-gray-400 hover:text-red-500 transition-colors ml-1"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => signIn()}
      className="text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
    >
      Sign in
    </button>
  );
}
