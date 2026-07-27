"use client";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

function Avatar({ user, className = "" }) {
  if (user?.image) {
    return (
      <img
        src={user.image}
        alt={user.name || "User"}
        className={`w-8 h-8 rounded-full object-cover ${className}`}
      />
    );
  }
  const initials = (user?.name || user?.email || "?")
    .split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className={`w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold ${className}`}>
      {initials}
    </div>
  );
}

export default function Navbar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  const isAuthPage = pathname === "/login";

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-950/90 backdrop-blur-sm">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-3">

        {/* Left: logo + nav links */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white text-xs font-bold select-none">
              IM
            </div>
            <span className="font-semibold text-gray-900 dark:text-gray-100 hidden sm:block text-sm">
              Interview Mastery
            </span>
          </Link>

          {!isAuthPage && (
            <nav className="flex items-center gap-1">
              {[
                { href: "/topics",   label: "Topics"   },
                { href: "/activity", label: "Activity" },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                    pathname?.startsWith(href)
                      ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </nav>
          )}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          <ThemeToggle />

          {isAuthPage ? null : status === "loading" ? (
            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
          ) : session?.user ? (
            <>
              <Link
                href="/profile"
                className="flex items-center gap-2 group border border-transparent hover:border-gray-200 dark:hover:border-gray-700 rounded-xl px-2 py-1 transition-colors"
              >
                <Avatar
                  user={session.user}
                  className="border-2 border-transparent group-hover:border-blue-400 transition-colors"
                />
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-tight">
                    {session.user.name || session.user.email}
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">Profile</p>
                </div>
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors px-1"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors px-2 py-1"
              >
                Sign in
              </Link>
              <Link
                href="/login"
                className="text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg transition-colors"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
