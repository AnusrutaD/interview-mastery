"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { filterByPeriod } from "@/core/domain/progress";
import { formatDate, formatTime } from "@/core/time/format";
import { DifficultyBadge, MasteryBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import {
  QUICK_PERIODS,
  recentMonths,
  recentWeeks,
  shortLabel,
  todayPeriod,
  yesterdayPeriod,
  type Period,
  type PeriodKind,
} from "@/features/activity/lib/periods";
import { useProgress } from "@/features/progress/hooks/useProgress";
import { cn } from "@/lib/cn";

export default function ActivityPage() {
  const { problems, loading, isAuthenticated } = useProgress();

  const [kind, setKind] = useState<PeriodKind>("today");
  const [weekIndex, setWeekIndex] = useState(0);
  const [monthIndex, setMonthIndex] = useState(0);

  // Built once per mount: the option lists are stable for the session.
  const weeks = useMemo(() => recentWeeks(12), []);
  const months = useMemo(() => recentMonths(12), []);

  const period: Period = useMemo(() => {
    switch (kind) {
      case "today":
        return todayPeriod();
      case "yesterday":
        return yesterdayPeriod();
      case "week":
        return weeks[weekIndex];
      case "month":
        return months[monthIndex];
    }
  }, [kind, weekIndex, monthIndex, weeks, months]);

  const solved = useMemo(
    () => filterByPeriod(problems, period.start, period.end),
    [problems, period]
  );

  const summary = useMemo(() => {
    const counts = {
      Easy: 0,
      Medium: 0,
      Hard: 0,
      unsolved: 0,
      learning: 0,
      familiar: 0,
      mastered: 0,
    } as Record<string, number>;
    for (const p of solved) {
      counts[p.difficulty] += 1;
      if (p.mastery !== "unseen") counts[p.mastery] += 1;
    }
    return counts;
  }, [solved]);

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">Activity</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Problems you&apos;ve practised, by time period
          </p>
        </header>

        <div className="flex flex-wrap gap-2 mb-4">
          {QUICK_PERIODS.map((option) => (
            <button
              key={option.kind}
              type="button"
              aria-pressed={kind === option.kind}
              onClick={() => {
                setKind(option.kind);
                if (option.kind === "week") setWeekIndex(0);
                if (option.kind === "month") setMonthIndex(0);
              }}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-lg border transition-colors",
                kind === option.kind
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-blue-300 dark:hover:border-blue-700"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex gap-3 mb-5 flex-wrap">
          <PeriodPicker
            label="Week"
            options={weeks}
            value={weekIndex}
            onChange={(index) => {
              setWeekIndex(index);
              setKind("week");
            }}
          />
          <PeriodPicker
            label="Month"
            options={months}
            value={monthIndex}
            onChange={(index) => {
              setMonthIndex(index);
              setKind("month");
            }}
          />
        </div>

        {solved.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-7 gap-2 mb-4">
            <SummaryTile label="Easy" value={summary.Easy} color="text-green-600 dark:text-green-400" />
            <SummaryTile label="Medium" value={summary.Medium} color="text-amber-600 dark:text-amber-400" />
            <SummaryTile label="Hard" value={summary.Hard} color="text-red-600 dark:text-red-400" />
            <SummaryTile label="Unsolved" value={summary.unsolved} color="text-rose-600 dark:text-rose-400" />
            <SummaryTile label="Learning" value={summary.learning} color="text-blue-600 dark:text-blue-400" />
            <SummaryTile label="Familiar" value={summary.familiar} color="text-amber-600 dark:text-amber-400" />
            <SummaryTile label="Mastered" value={summary.mastered} color="text-green-600 dark:text-green-400" />
          </div>
        )}

        <Card padded={false} className="overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {shortLabel(period.label)}
            </h2>
            <span className="text-xs font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-full">
              {solved.length} problem{solved.length === 1 ? "" : "s"}
            </span>
          </div>

          {!isAuthenticated ? (
            <EmptyState
              icon="🔒"
              title="Sign in to see your activity"
              action={
                <Link href="/login" className="text-sm text-blue-500 hover:underline">
                  Sign in →
                </Link>
              }
            />
          ) : loading ? (
            <Spinner />
          ) : solved.length === 0 ? (
            <EmptyState title="No problems practised in this period" />
          ) : (
            <ul>
              {solved.map((problem, index) => (
                <li
                  key={problem.id}
                  className={cn(
                    "px-5 py-3.5 flex items-center gap-3",
                    index < solved.length - 1 && "border-b border-gray-100 dark:border-gray-800"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-xs text-gray-400 dark:text-gray-600 font-mono shrink-0">
                        #{problem.id}
                      </span>
                      <DifficultyBadge difficulty={problem.difficulty} size="xs" />
                      <MasteryBadge mastery={problem.mastery} size="xs" />
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 hidden sm:inline">
                        {problem.category}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 leading-snug">
                      {problem.title}
                    </p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                      🕐 {formatDate(problem.lastMasteryAt!)} · {formatTime(problem.lastMasteryAt!)}
                    </p>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <Link
                      href={`/problems/${problem.id}`}
                      className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Detail →
                    </Link>
                    <a
                      href={problem.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-orange-500 dark:text-orange-400 hover:underline"
                    >
                      LC →
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function PeriodPicker({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Period[];
  value: number;
  onChange: (index: number) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0">
        {label}:
      </span>
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-600"
      >
        {options.map((option, index) => (
          <option key={option.start} value={index}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SummaryTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-2.5 text-center">
      <p className={cn("text-lg font-bold", color)}>{value}</p>
      <p className="text-[10px] text-gray-400 dark:text-gray-500">{label}</p>
    </div>
  );
}
