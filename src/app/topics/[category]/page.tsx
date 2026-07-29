"use client";
import { use, useMemo } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { compareDifficulty, DIFFICULTIES } from "@/core/domain/difficulty";
import { suggestNext } from "@/core/domain/progress";
import { reviewLabel } from "@/core/domain/review";
import { Card } from "@/components/ui/Card";
import { DifficultyBadge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Spinner } from "@/components/ui/Spinner";
import { categoryIcon } from "@/data/categories";
import { slugToCategory } from "@/data/problems";
import { MasterySelector } from "@/features/problems/components/MasterySelector";
import { useProgress } from "@/features/progress/hooks/useProgress";
import { cn } from "@/lib/cn";

export default function TopicPage({ params }: { params: Promise<{ category: string }> }) {
  const { category: slug } = use(params);
  const category = slugToCategory(slug);
  if (!category) notFound();

  // Scoped fetch: only this category's progress crosses the network.
  const { problems, stats, loading, isAuthenticated, setMastery } = useProgress({ category });

  const sorted = useMemo(
    () => [...problems].sort((a, b) => compareDifficulty(a.difficulty, b.difficulty) || a.id - b.id),
    [problems]
  );
  const next = useMemo(() => suggestNext(problems), [problems]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8">
        <nav className="text-xs text-gray-400 dark:text-gray-500 mb-3 flex items-center gap-1.5">
          <Link href="/" className="hover:text-blue-500 transition-colors">Dashboard</Link>
          <span>/</span>
          <Link href="/topics" className="hover:text-blue-500 transition-colors">Topics</Link>
          <span>/</span>
          <span className="text-gray-600 dark:text-gray-300">{category}</span>
        </nav>

        <header className="flex items-center gap-3 mb-5">
          <span className="text-3xl" aria-hidden>{categoryIcon(category)}</span>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{category}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {stats.attempted} of {stats.total} attempted
              {stats.due > 0 && (
                <span className="text-red-500 font-medium"> · {stats.due} due for review</span>
              )}
            </p>
          </div>
        </header>

        {loading ? (
          <Spinner />
        ) : (
          <>
            <Card className="mb-4">
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                <span>Overall progress</span>
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  {stats.completionPercent}%
                </span>
              </div>
              <ProgressBar value={stats.attempted} max={stats.total} height="h-2.5" className="mb-4" />

              <div className="grid grid-cols-3 gap-3">
                {DIFFICULTIES.map((difficulty) => {
                  const s = stats.byDifficulty[difficulty];
                  if (s.total === 0) return null;
                  return (
                    <div key={difficulty}>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">
                        {difficulty}{" "}
                        <span className="text-gray-400 dark:text-gray-600">
                          {s.attempted}/{s.total}
                        </span>
                      </p>
                      <ProgressBar
                        value={s.attempted}
                        max={s.total}
                        height="h-1"
                        barClassName={
                          difficulty === "Easy"
                            ? "bg-green-500"
                            : difficulty === "Medium"
                              ? "bg-amber-500"
                              : "bg-red-500"
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </Card>

            {next && (
              <Card padded={false} className="p-4 mb-4 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30">
                <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-1">
                  {next.due ? "Due for review" : "Next up"}
                </p>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
                      {next.title}
                    </p>
                    <DifficultyBadge difficulty={next.difficulty} size="xs" />
                  </div>
                  <Link
                    href={`/problems/${next.id}?from=${slug}`}
                    className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors shrink-0"
                  >
                    Start →
                  </Link>
                </div>
              </Card>
            )}

            <Card padded={false} className="overflow-hidden">
              <ul>
                {sorted.map((problem, index) => {
                  const status = reviewLabel(problem.mastery, problem.lastMasteryAt);
                  return (
                    <li
                      key={problem.id}
                      className={cn(
                        "px-4 py-3",
                        index < sorted.length - 1 && "border-b border-gray-100 dark:border-gray-800"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-xs text-gray-400 dark:text-gray-600 font-mono">
                          #{problem.id}
                        </span>
                        <DifficultyBadge difficulty={problem.difficulty} size="xs" />
                        <Link
                          href={`/problems/${problem.id}?from=${slug}`}
                          className="text-sm font-medium text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          {problem.title}
                        </Link>
                        {problem.due && (
                          <span className="text-[10px] font-semibold text-red-500" title={status ?? "Due"}>
                            🔴 due
                          </span>
                        )}
                        <a
                          href={problem.url}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-auto text-xs font-medium text-orange-500 dark:text-orange-400 hover:underline shrink-0"
                        >
                          LC →
                        </a>
                      </div>
                      <MasterySelector
                        value={problem.mastery}
                        onChange={(level) => void setMastery(problem.id, level)}
                        disabled={!isAuthenticated}
                      />
                    </li>
                  );
                })}
              </ul>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
