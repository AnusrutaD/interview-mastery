"use client";
import { Suspense, use, useMemo, useState } from "react";
import Link from "next/link";
import { notFound, useSearchParams } from "next/navigation";
import { MASTERY_CONFIG } from "@/core/domain/mastery";
import { reviewIntervalFor } from "@/core/domain/review";
import { formatDateWithWeekday, formatRelative, formatTime } from "@/core/time/format";
import { Card, CardHeader } from "@/components/ui/Card";
import { DifficultyBadge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { categoryHints } from "@/data/categories";
import { getProblemById, slugToCategory } from "@/data/problems";
import { MarkdownNote } from "@/features/notes/components/MarkdownNote";
import { MasterySelector } from "@/features/problems/components/MasterySelector";
import { ProblemNavigator } from "@/features/problems/components/ProblemNavigator";
import { useProblemSession } from "@/features/progress/hooks/useProblemSession";
import { SolveTimer } from "@/features/timer/components/SolveTimer";
import { cn } from "@/lib/cn";

export default function ProblemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const problem = getProblemById(Number.parseInt(id, 10));
  if (!problem) notFound();

  const session = useProblemSession(problem.id);
  const { record, loading, saving, error, isAuthenticated, due, reviewStatus, lastSession, timer } =
    session;

  const hints = useMemo(() => categoryHints(problem.category), [problem.category]);
  const interval = reviewIntervalFor(record.mastery);
  const masteryCfg = MASTERY_CONFIG[record.mastery];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Suspense fallback={null}>
          <ScopedBackLink />
        </Suspense>

        <Suspense fallback={null}>
          <ScopedNavigator problemId={problem.id} variant="bar" />
        </Suspense>

        {error && (
          <div
            role="alert"
            className="mt-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl px-4 py-2.5 text-xs text-red-700 dark:text-red-400"
          >
            {error}
          </div>
        )}

        <Card className="mt-3 mb-4">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                  #{problem.id}
                </span>
                <DifficultyBadge difficulty={problem.difficulty} />
                <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">
                  {problem.category}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  LC #{problem.leetcode}
                </span>
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{problem.title}</h1>
            </div>

            {reviewStatus && (
              <div
                className={cn(
                  "shrink-0 text-center px-3 py-2 rounded-xl border",
                  due
                    ? "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800"
                    : "bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800"
                )}
              >
                <p
                  className={cn(
                    "text-xs font-semibold",
                    due
                      ? "text-red-600 dark:text-red-400"
                      : "text-green-600 dark:text-green-400"
                  )}
                >
                  {due ? "🔴 " : "✅ "}
                  {reviewStatus}
                </p>
                {record.lastMasteryAt && (
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                    Practised {formatRelative(record.lastMasteryAt)}
                  </p>
                )}
                {interval && (
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">Every {interval}d</p>
                )}
              </div>
            )}
          </div>

          <SolveTimer
            timer={timer}
            totalTimeSeconds={record.totalTimeSeconds}
            attempts={record.repeatCount}
            lastSession={lastSession}
          />

          {record.lastMasteryAt && (
            <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-800">
              <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide">
                Last Solved
              </p>
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                {formatDateWithWeekday(record.lastMasteryAt)} ·{" "}
                {formatTime(record.lastMasteryAt)}
              </p>
            </div>
          )}
        </Card>

        <Card padded={false} className="p-4 mb-4">
          <div className="flex gap-2 flex-wrap">
            <ExternalLink href={problem.url} className="bg-orange-500 hover:bg-orange-600">
              Open on LeetCode →
            </ExternalLink>
            <ExternalLink
              href={`https://www.youtube.com/results?search_query=neetcode+${encodeURIComponent(problem.title)}`}
              className="bg-red-600 hover:bg-red-700"
            >
              NeetCode Solution ▶
            </ExternalLink>
            <a
              href="https://neetcode.io/"
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 px-4 py-2 rounded-lg transition-colors"
            >
              NeetCode.io
            </a>
          </div>
        </Card>

        <Card className="mb-4">
          <CardHeader
            title="Mastery Level"
            action={saving ? <span className="text-xs text-blue-500 animate-pulse">Saving…</span> : null}
            className="mb-3"
          />
          {loading ? (
            <Spinner />
          ) : (
            <>
              <MasterySelector
                value={record.mastery}
                onChange={(level) => void session.setMastery(level)}
                disabled={!isAuthenticated}
                size="md"
              />
              {interval && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
                  At{" "}
                  <strong className={cn(masteryCfg.textColor, masteryCfg.darkTextColor)}>
                    {masteryCfg.label}
                  </strong>{" "}
                  level — scheduled review every {interval} day{interval > 1 ? "s" : ""}.
                </p>
              )}
            </>
          )}
        </Card>

        {hints.length > 0 && <HintsPanel category={problem.category} hints={hints} />}

        <MarkdownNote
          value={record.notes ?? ""}
          onSave={(next) => session.setNotes(next)}
          saving={saving}
          disabled={!isAuthenticated}
        />

        <Suspense fallback={null}>
          <ScopedNavigator problemId={problem.id} variant="cards" />
        </Suspense>

        <p className="text-[10px] text-gray-300 dark:text-gray-700 text-center mt-3">
          Tip: use ← and → to move between problems
        </p>
      </div>
    </div>
  );
}

/**
 * Reads the `?from=<category-slug>` scope written by the topic pages.
 *
 * `useSearchParams` opts a route into client-side rendering, so both consumers
 * sit behind Suspense to keep the rest of the page statically renderable.
 */
function useScope() {
  const params = useSearchParams();
  const slug = params.get("from");
  const category = slug ? slugToCategory(slug) : null;
  return { slug: category ? slug! : undefined, category: category ?? undefined };
}

function ScopedNavigator({
  problemId,
  variant,
}: {
  problemId: number;
  variant: "bar" | "cards";
}) {
  const { slug, category } = useScope();
  return (
    <ProblemNavigator
      problemId={problemId}
      category={category}
      scopeParam={slug}
      variant={variant}
    />
  );
}

/** Returns the user to wherever they came from, not always the dashboard. */
function ScopedBackLink() {
  const { slug, category } = useScope();
  return (
    <Link
      href={category ? `/topics/${slug}` : "/"}
      className="text-xs text-gray-400 dark:text-gray-500 hover:text-blue-500 transition-colors"
    >
      ← Back to {category ?? "Dashboard"}
    </Link>
  );
}

function ExternalLink({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "flex items-center gap-1.5 text-xs font-semibold text-white px-4 py-2 rounded-lg transition-colors",
        className
      )}
    >
      {children}
    </a>
  );
}

function HintsPanel({ category, hints }: { category: string; hints: readonly string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Card padded={false} className="mb-4 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-6 py-4 text-left"
      >
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          💡 {category} Hints
        </span>
        <span className="text-gray-400 dark:text-gray-500 text-xs">
          {open ? "▲ Hide" : "▼ Show"}
        </span>
      </button>
      {open && (
        <ol className="px-6 pb-5 flex flex-col gap-3 border-t border-gray-100 dark:border-gray-800 pt-4">
          {hints.map((hint, index) => (
            <li key={hint} className="flex gap-3">
              <span className="text-blue-500 dark:text-blue-400 font-bold text-sm shrink-0">
                {index + 1}.
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                {hint}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
