import type { Metadata } from "next";
import type { ReactNode } from "react";
import { auth } from "@/auth";
import { Navbar } from "@/components/layout/Navbar";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Interview Mastery",
  description: "Track your NeetCode 150 progress with spaced repetition",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors duration-200">
        <ThemeProvider>
          <SessionProvider session={session}>
            <Navbar />
            <main>{children}</main>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
