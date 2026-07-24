import "./globals.css";
import { auth } from "@/auth";
import SessionWrapper from "@/components/SessionWrapper";
import ThemeProvider from "@/components/ThemeProvider";

export const metadata = {
  title: "Interview Mastery",
  description: "Track your NeetCode 150 progress",
};

export default async function RootLayout({ children }) {
  const session = await auth();
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors duration-200">
        <ThemeProvider>
          <SessionWrapper session={session}>
            {children}
          </SessionWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}
