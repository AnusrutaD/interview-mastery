import "./globals.css";
import { auth } from "@/auth";
import SessionWrapper from "@/components/SessionWrapper";

export const metadata = {
  title: "LeetCode Mastery",
  description: "Track your NeetCode 150 progress",
};

export default async function RootLayout({ children }) {
  const session = await auth();
  return (
    <html lang="en">
      <body>
        <SessionWrapper session={session}>
          {children}
        </SessionWrapper>
      </body>
    </html>
  );
}
