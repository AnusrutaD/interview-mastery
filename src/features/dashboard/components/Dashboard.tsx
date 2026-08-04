"use client";
import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useProgress } from "@/features/progress/hooks/useProgress";
import {
  applyFilters,
  DEFAULT_FILTERS,
  ProblemFilters,
  type ProblemFilterState,
} from "@/features/problems/components/ProblemFilters";
import { ProblemTable } from "@/features/problems/components/ProblemTable";
import { Spinner } from "@/components/ui/Spinner";
import { StatsBar } from "./StatsBar";
import { TopicGrid } from "./TopicGrid";

const PAGE_STORAGE_KEY = "im:dashboard:page";

function readStoredPage(): number {
  if (typeof window === "undefined") return 1;
  const raw = Number.parseInt(window.localStorage.getItem(PAGE_STORAGE_KEY) ?? "", 10);
  return Number.isInteger(raw) && raw > 0 ? raw : 1;
}

export function Dashboard() {
  const {
    problems,
    stats,
    loading,
    syncing,
    error,
    isAuthenticated,
    setMastery,
    setNotes,
    revise,
    setReviewFlag,
  } = useProgress();

  const [filters, setFilters] = useState<ProblemFilterState>(DEFAULT_FILTERS);
  const [page, setPage] = useState(readStoredPage);

  const handleFilterChange = useCallback(
    <K extends keyof ProblemFilterState>(key: K, next: ProblemFilterState[K]) => {
      setFilters((current) => ({ ...current, [key]: next }));
      setPage(1);
    },
    []
  );

  const handlePageChange = useCallback((next: number) => {
    setPage(next);
    window.localStorage.setItem(PAGE_STORAGE_KEY, String(next));
  }, []);

  const filtered = useMemo(() => applyFilters(problems, filters), [problems, filters]);

  const today = useMemo(
    () =>
      new Date().toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        weekday: "long",
        month: "short",
        day: "numeric",
      }),
    []
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
        <header className="flex items-center justify-between mb-5">
          <p className="text-xs text-gray-400 dark:text-gray-500">{today} · NeetCode 150</p>
          <div className="flex items-center gap-3">
            {syncing && <span className="text-xs text-blue-500 animate-pulse">Syncing…</span>}
            <div className="text-right">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 leading-none">
                {stats.attempted}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">/ {stats.total} attempted</p>
            </div>
          </div>
        </header>

        {!isAuthenticated && (
          <div className="mb-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              You&apos;re not signed in — progress won&apos;t be saved.
            </p>
            <Link
              href="/login"
              className="text-xs font-semibold text-amber-800 dark:text-amber-300 underline whitespace-nowrap"
            >
              Sign in →
            </Link>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mb-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-xs text-red-700 dark:text-red-400"
          >
            {error}
          </div>
        )}

        {loading ? (
          <Spinner label="Loading your progress" />
        ) : (
          <>
            <StatsBar stats={stats} />
            <TopicGrid problems={problems} />
            <ProblemFilters value={filters} onChange={handleFilterChange} />

            <p className="text-xs text-gray-400 dark:text-gray-500 mb-3 mt-1">
              {filtered.length} problems · Tap a row to expand · Click mastery to update
            </p>

            <ProblemTable
              problems={filtered}
              onSetMastery={(id, level) => void setMastery(id, level)}
              onSaveNote={(id, note) => void setNotes(id, note)}
              onRevise={(id) => void revise(id)}
              onToggleFlag={(id, flagged) => void setReviewFlag(id, flagged)}
              page={page}
              onPageChange={handlePageChange}
              disabled={!isAuthenticated}
            />
          </>
        )}
      </div>
    </div>
  );
}
