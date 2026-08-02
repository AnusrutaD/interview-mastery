import Link from "next/link";
import { SD_PATTERNS, patternIcon } from "@/core/domain/systemDesign";
import { getAllStudyItems, toSummary } from "@/server/content/studyContent";
import { SystemDesignRoadmap } from "@/features/system-design/components/SystemDesignRoadmap";

export const metadata = {
  title: "System Design · Interview Mastery",
  description: "Learn system design patterns, then practise open-ended design exercises.",
};

/**
 * Server component: reads content from disk and hands the client only what it
 * needs to render. Reference solutions never reach the browser from here.
 */
export default function SystemDesignPage() {
  const items = getAllStudyItems().map(toSummary);

  // Only show patterns that actually have content yet — an empty roadmap row
  // reads as a broken page rather than as "coming soon".
  const patterns = SD_PATTERNS.filter((pattern) => items.some((i) => i.pattern === pattern));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8">
        <header className="mb-6">
          <Link
            href="/"
            className="text-xs text-gray-400 dark:text-gray-500 hover:text-blue-500 transition-colors"
          >
            ← Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
            System Design
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
            Read a concept, check it with a quiz, then attempt a design exercise and score
            yourself against the rubric.
          </p>
        </header>

        <SystemDesignRoadmap
          items={items}
          patterns={patterns.map((p) => ({ name: p, icon: patternIcon(p) }))}
        />
      </div>
    </div>
  );
}
