"use client";
import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DIFFICULTY_CONFIG } from "@/core/domain/difficulty";
import type { Problem } from "@/core/domain/progress";
import { getNeighbours } from "@/data/problems";
import { cn } from "@/lib/cn";

interface ProblemNavigatorProps {
  problemId: number;
  /** When set, navigation stays inside this category. */
  category?: string;
  /** Preserved in the target URL so the scope survives navigation. */
  scopeParam?: string;
  /** Compact variant for the top of the page. */
  variant?: "bar" | "cards";
}

function href(problem: Problem, scopeParam?: string): string {
  return scopeParam
    ? `/problems/${problem.id}?from=${encodeURIComponent(scopeParam)}`
    : `/problems/${problem.id}`;
}

/**
 * Previous / next navigation through the problem sequence.
 *
 * Also binds ← and → so the keyboard works the way it does on LeetCode itself.
 * The shortcut is suppressed while the user is typing, otherwise arrow keys
 * inside the notes editor would navigate away mid-sentence.
 */
export function ProblemNavigator({
  problemId,
  category,
  scopeParam,
  variant = "cards",
}: ProblemNavigatorProps) {
  const router = useRouter();
  const { previous, next, position, total } = useMemo(
    () => getNeighbours(problemId, category),
    [problemId, category]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const typing =
        target?.isContentEditable ||
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT";
      if (typing) return;

      if (event.key === "ArrowLeft" && previous) {
        event.preventDefault();
        router.push(href(previous, scopeParam));
      } else if (event.key === "ArrowRight" && next) {
        event.preventDefault();
        router.push(href(next, scopeParam));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previous, next, scopeParam, router]);

  if (total === 0) return null;

  if (variant === "bar") {
    return (
      <nav
        aria-label="Problem navigation"
        className="flex items-center justify-between gap-3 mt-3"
      >
        <ArrowButton problem={previous} scopeParam={scopeParam} direction="previous" />
        <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums shrink-0">
          {position} / {total}
          {category && <span className="hidden sm:inline"> in {category}</span>}
        </span>
        <ArrowButton problem={next} scopeParam={scopeParam} direction="next" />
      </nav>
    );
  }

  return (
    <nav aria-label="Problem navigation" className="grid grid-cols-2 gap-3 mt-4">
      <NeighbourCard problem={previous} scopeParam={scopeParam} direction="previous" />
      <NeighbourCard problem={next} scopeParam={scopeParam} direction="next" />
    </nav>
  );
}

function ArrowButton({
  problem,
  scopeParam,
  direction,
}: {
  problem: Problem | null;
  scopeParam?: string;
  direction: "previous" | "next";
}) {
  const label = direction === "previous" ? "← Prev" : "Next →";
  const base =
    "text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors shrink-0";

  if (!problem) {
    return (
      <span
        aria-disabled
        className={cn(
          base,
          "border-gray-200 dark:border-gray-800 text-gray-300 dark:text-gray-700 cursor-not-allowed"
        )}
      >
        {label}
      </span>
    );
  }

  return (
    <Link
      href={href(problem, scopeParam)}
      title={problem.title}
      className={cn(
        base,
        "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400"
      )}
    >
      {label}
    </Link>
  );
}

function NeighbourCard({
  problem,
  scopeParam,
  direction,
}: {
  problem: Problem | null;
  scopeParam?: string;
  direction: "previous" | "next";
}) {
  const isPrevious = direction === "previous";
  const heading = isPrevious ? "← Previous" : "Next →";

  if (!problem) {
    // Render a placeholder so the surviving card keeps its column and the
    // layout does not jump at the ends of the sequence.
    return (
      <div
        aria-hidden
        className="border border-dashed border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 flex items-center"
      >
        <span className="text-xs text-gray-300 dark:text-gray-700">
          {isPrevious ? "Start of list" : "End of list"}
        </span>
      </div>
    );
  }

  const diff = DIFFICULTY_CONFIG[problem.difficulty];

  return (
    <Link
      href={href(problem, scopeParam)}
      className={cn(
        "group border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3",
        "bg-white dark:bg-gray-900 hover:border-blue-300 dark:hover:border-blue-600 transition-colors",
        !isPrevious && "text-right"
      )}
    >
      <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">
        {heading}
      </p>
      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
        {problem.title}
      </p>
      <p className={cn("text-[10px] mt-0.5", diff.textColor, diff.darkTextColor)}>
        {problem.difficulty}
      </p>
    </Link>
  );
}
