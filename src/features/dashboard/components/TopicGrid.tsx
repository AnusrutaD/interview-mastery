"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { ProblemWithProgress } from "@/core/domain/progress";
import { categoryToSlug } from "@/data/problems";
import { catalog } from "@/data/catalog";
import { categoryIcon } from "@/data/categories";

const COLLAPSED_COUNT = 6;

export function TopicGrid({ problems }: { problems: readonly ProblemWithProgress[] }) {
  const [collapsed, setCollapsed] = useState(true);

  const topics = useMemo(() => {
    const byCategory = new Map<string, { attempted: number; total: number; due: number }>();
    for (const category of catalog.categories()) {
      byCategory.set(category, { attempted: 0, total: 0, due: 0 });
    }
    for (const p of problems) {
      const entry = byCategory.get(p.category);
      if (!entry) continue;
      entry.total += 1;
      if (p.mastery !== "unseen") entry.attempted += 1;
      if (p.due) entry.due += 1;
    }
    return catalog.categories().map((category) => {
      const s = byCategory.get(category)!;
      return {
        category,
        ...s,
        percent: s.total ? Math.round((s.attempted / s.total) * 100) : 0,
        slug: categoryToSlug(category),
      };
    });
  }, [problems]);

  const visible = collapsed ? topics.slice(0, COLLAPSED_COUNT) : topics;

  return (
    <section className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Study by Topic
        </h2>
        <Link href="/topics" className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
          View all →
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
        {visible.map(({ category, attempted, total, percent, due, slug }) => (
          <Link
            key={category}
            href={`/topics/${slug}`}
            className="group relative flex items-center gap-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 rounded-xl px-3 py-2.5 transition-colors overflow-hidden"
          >
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 bg-blue-50 dark:bg-blue-950/30 transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
            <span className="relative text-lg shrink-0" aria-hidden>
              {categoryIcon(category)}
            </span>
            <span className="relative flex-1 min-w-0">
              <span className="block text-xs font-semibold text-gray-700 dark:text-gray-200 truncate leading-tight">
                {category}
              </span>
              <span className="block text-[10px] text-gray-400 dark:text-gray-500">
                {attempted}/{total}
                {due > 0 && <span className="ml-1.5 text-red-500 font-semibold">· {due} due</span>}
              </span>
            </span>
          </Link>
        ))}
      </div>

      {topics.length > COLLAPSED_COUNT && (
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="text-xs text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
        >
          {collapsed ? `Show all ${topics.length} topics ▼` : "Show less ▲"}
        </button>
      )}
    </section>
  );
}
