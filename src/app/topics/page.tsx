"use client";
import { useMemo } from "react";
import Link from "next/link";
import { DIFFICULTIES } from "@/core/domain/difficulty";
import type { ProblemWithProgress } from "@/core/domain/progress";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Spinner } from "@/components/ui/Spinner";
import { categoryIcon } from "@/data/categories";
import { CATEGORIES, categoryToSlug } from "@/data/problems";
import { useProgress } from "@/features/progress/hooks/useProgress";

interface TopicSummary {
  category: string;
  slug: string;
  icon: string;
  total: number;
  attempted: number;
  due: number;
  percent: number;
  byDifficulty: Record<string, { total: number; attempted: number }>;
}

function summarizeTopics(problems: readonly ProblemWithProgress[]): TopicSummary[] {
  return CATEGORIES.map((category) => {
    const items = problems.filter((p) => p.category === category);
    const attempted = items.filter((p) => p.mastery !== "unseen").length;
    const byDifficulty = Object.fromEntries(
      DIFFICULTIES.map((d) => {
        const set = items.filter((p) => p.difficulty === d);
        return [d, { total: set.length, attempted: set.filter((p) => p.mastery !== "unseen").length }];
      })
    );
    return {
      category,
      slug: categoryToSlug(category),
      icon: categoryIcon(category),
      total: items.length,
      attempted,
      due: items.filter((p) => p.due).length,
      percent: items.length ? Math.round((attempted / items.length) * 100) : 0,
      byDifficulty,
    };
  });
}

export default function TopicsPage() {
  const { problems, stats, loading } = useProgress();
  const topics = useMemo(() => summarizeTopics(problems), [problems]);
  const complete = topics.filter((t) => t.percent === 100).length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8">
        <header className="mb-5">
          <Link href="/" className="text-xs text-gray-400 dark:text-gray-500 hover:text-blue-500 transition-colors">
            ← Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">Study by Topic</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Work through one pattern at a time — the most effective way to build recall.
          </p>
        </header>

        {loading ? (
          <Spinner />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 mb-5">
              <Tile label="Attempted" value={`${stats.attempted}/${stats.total}`} color="text-blue-600 dark:text-blue-400" />
              <Tile label="Due for review" value={String(stats.due)} color="text-red-600 dark:text-red-400" />
              <Tile label="Topics complete" value={`${complete}/${topics.length}`} color="text-green-600 dark:text-green-400" />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              {topics.map((topic) => (
                <Link key={topic.category} href={`/topics/${topic.slug}`} className="block group">
                  <Card padded={false} className="p-4 h-full group-hover:border-blue-300 dark:group-hover:border-blue-600 transition-colors">
                    <div className="flex items-center gap-2.5 mb-3">
                      <span className="text-xl shrink-0" aria-hidden>{topic.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
                          {topic.category}
                        </p>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500">
                          {topic.attempted}/{topic.total} attempted
                        </p>
                      </div>
                      {topic.percent === 100 && (
                        <span className="text-[10px] font-semibold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">
                          ✓ Done
                        </span>
                      )}
                      {topic.due > 0 && (
                        <span className="text-[10px] font-semibold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-full">
                          {topic.due} due
                        </span>
                      )}
                    </div>

                    <ProgressBar value={topic.attempted} max={topic.total} className="mb-2" />

                    <div className="flex gap-3">
                      {DIFFICULTIES.map((d) => {
                        const s = topic.byDifficulty[d];
                        if (!s || s.total === 0) return null;
                        return (
                          <span key={d} className="text-[10px] text-gray-400 dark:text-gray-500">
                            {d} {s.attempted}/{s.total}
                          </span>
                        );
                      })}
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Tile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-center">
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-gray-400 dark:text-gray-500">{label}</p>
    </div>
  );
}
