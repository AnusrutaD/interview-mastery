import "./globals.css";
import { auth } from "@/auth";
import SessionWrapper from "@/components/SessionWrapper";
import ThemeProvider from "@/components/ThemeProvider";
import Navbar from "@/components/Navbar";

export const metadata = {
  title: "Interview Mastery",
  description: "Track your NeetCode 150 progress",
};

export default async function RootLayout({ children }) {
  const session = await auth();
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors duration-200">
        <ThemeProvider>
          <SessionWrapper session={session}>
            <Navbar />
            <main>{children}</main>
          </SessionWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}
