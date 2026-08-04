"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { MasteryLevel } from "@/core/domain/mastery";
import type { ProblemWithProgress } from "@/core/domain/progress";
import { reviewAnchor, reviewLabel } from "@/core/domain/review";
import { formatDateTime, formatDuration } from "@/core/time/format";
import { DifficultyBadge, MasteryBadge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { MasterySelector } from "./MasterySelector";
import { ReviewControls } from "@/features/items/components/ReviewControls";
import { problemHref } from "@/data/catalog";

const PAGE_SIZE = 5;
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;

interface ProblemTableProps {
  problems: ProblemWithProgress[];
  onSetMastery: (problemId: number, mastery: MasteryLevel) => void;
  onSaveNote: (problemId: number, note: string) => void;
  /** Clear a due problem by reviewing it. Controls hidden when omitted. */
  onRevise?: (problemId: number) => void;
  onToggleFlag?: (problemId: number, flagged: boolean) => void;
  page: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

export function ProblemTable({
  problems,
  onSetMastery,
  onSaveNote,
  onRevise,
  onToggleFlag,
  page,
  onPageChange,
  disabled,
}: ProblemTableProps) {
  const totalPages = Math.max(1, Math.ceil(problems.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const paged = problems.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const pageTokens = useMemo(() => buildPagination(safePage, totalPages), [safePage, totalPages]);

  if (problems.length === 0) {
    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-12 text-center text-gray-400 dark:text-gray-500 text-sm">
        No problems match your filters
      </div>
    );
  }

  const week = Math.ceil(safePage / 5);
  const dayName = DAY_NAMES[(safePage - 1) % 5];

  return (
    <div>
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold bg-blue-600 text-white px-2.5 py-1 rounded-full">
            Week {week}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            {dayName} · Day {safePage}
          </span>
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, problems.length)} of{" "}
          {problems.length}
        </span>
      </div>

      <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden mb-4 bg-white dark:bg-gray-900">
        <table className="w-full text-sm border-collapse table-fixed">
          <colgroup>
            <col style={{ width: "2.5rem" }} />
            <col />
            <col style={{ width: "6rem" }} />
            <col style={{ width: "7rem" }} />
            <col style={{ width: "2rem" }} />
          </colgroup>
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <Th>#</Th>
              <Th>Problem</Th>
              <Th className="hidden sm:table-cell">Difficulty</Th>
              <Th>Mastery</Th>
              <th />
            </tr>
          </thead>
          <tbody>
            {paged.map((problem) => (
              <ProblemRow
                key={problem.id}
                problem={problem}
                onSetMastery={onSetMastery}
                onSaveNote={onSaveNote}
                onRevise={onRevise}
                onToggleFlag={onToggleFlag}
                disabled={disabled}
              />
            ))}
          </tbody>
        </table>
      </div>

      <nav className="flex items-center justify-between gap-2" aria-label="Pagination">
        <PageButton onClick={() => onPageChange(safePage - 1)} disabled={safePage === 1}>
          ← Prev
        </PageButton>

        <div className="flex items-center gap-1 flex-wrap justify-center">
          {pageTokens.map((token, index) =>
            token === "…" ? (
              <span key={`gap-${index}`} className="px-1 text-gray-400 text-xs">
                …
              </span>
            ) : (
              <button
                key={token}
                type="button"
                onClick={() => onPageChange(token)}
                aria-current={token === safePage ? "page" : undefined}
                className={cn(
                  "w-8 h-8 text-xs rounded-lg font-semibold transition-colors",
                  token === safePage
                    ? "bg-blue-600 text-white"
                    : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                )}
              >
                {token}
              </button>
            )
          )}
        </div>

        <PageButton onClick={() => onPageChange(safePage + 1)} disabled={safePage === totalPages}>
          Next →
        </PageButton>
      </nav>
    </div>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400",
        className
      )}
    >
      {children}
    </th>
  );
}

function PageButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      {children}
    </button>
  );
}

function ProblemRow({
  problem,
  onSetMastery,
  onSaveNote,
  onRevise,
  onToggleFlag,
  disabled,
}: {
  problem: ProblemWithProgress;
  onSetMastery: (problemId: number, mastery: MasteryLevel) => void;
  onSaveNote: (problemId: number, note: string) => void;
  onRevise?: (problemId: number) => void;
  onToggleFlag?: (problemId: number, flagged: boolean) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draftNote, setDraftNote] = useState(problem.notes ?? "");
  // Anchored on the same timestamp the due badge uses. Reading `lastMasteryAt`
  // directly would ignore revisions, so a freshly revised problem would read
  // "Overdue by 5d" while showing as not due.
  const status = reviewLabel(
    problem.mastery,
    reviewAnchor({
      mastery: problem.mastery,
      lastPracticedAt: problem.lastMasteryAt,
      lastRevisedAt: problem.lastRevisedAt,
      flaggedForReviewAt: problem.flaggedForReviewAt,
    })
  );

  return (
    <>
      <tr
        onClick={() => setOpen((v) => !v)}
        className="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
      >
        <td className="px-3 py-3 text-xs text-gray-400 dark:text-gray-600 font-mono">
          {problem.id}
        </td>
        <td className="px-3 py-3">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-800 dark:text-gray-200 truncate">
              {problem.title}
            </span>
            {problem.due && (
              <span
                className={cn(
                  "text-xs shrink-0",
                  problem.flagged ? "text-purple-500" : "text-red-500"
                )}
                title={problem.flagged ? "You flagged this for review" : (status ?? "Due")}
              >
                {problem.flagged ? "★" : "🔴"}
              </span>
            )}
          </div>
        </td>
        <td className="px-3 py-3 hidden sm:table-cell">
          <DifficultyBadge difficulty={problem.difficulty} />
        </td>
        <td className="px-3 py-3">
          <MasteryBadge mastery={problem.mastery} />
        </td>
        <td className="px-3 py-3 text-gray-300 dark:text-gray-600 text-xs">
          {open ? "▲" : "▼"}
        </td>
      </tr>

      {open && (
        <tr>
          <td colSpan={5} className="px-4 py-4 bg-blue-50/40 dark:bg-blue-950/20">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-full">
                  {problem.category}
                </span>
                <DifficultyBadge difficulty={problem.difficulty} />
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  LC #{problem.leetcode}
                </span>

                {problem.lastMasteryAt && (
                  <Meta label="Last solved" value={formatDateTime(problem.lastMasteryAt)} />
                )}
                {problem.lastRevisedAt && (
                  <Meta label="Last revised" value={formatDateTime(problem.lastRevisedAt)} />
                )}
                {problem.totalTimeSeconds > 0 && (
                  <Meta
                    label="⏱"
                    value={
                      problem.repeatCount > 1
                        ? `${formatDuration(problem.totalTimeSeconds)} (${formatDuration(
                            Math.round(problem.totalTimeSeconds / problem.repeatCount)
                          )} avg)`
                        : formatDuration(problem.totalTimeSeconds)
                    }
                  />
                )}

                <div
                  className="ml-auto flex items-center gap-2"
                  onClick={(event) => event.stopPropagation()}
                >
                  <Link
                    href={problemHref(problem.id) ?? "#"}
                    className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition-colors"
                  >
                    Detail →
                  </Link>
                  <a
                    href={problem.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg transition-colors"
                  >
                    LeetCode →
                  </a>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">Mastery</p>
                <MasterySelector
                  value={problem.mastery}
                  onChange={(level) => onSetMastery(problem.id, level)}
                  disabled={disabled}
                />
              </div>

              {(onRevise || onToggleFlag) && (
                <div onClick={(event) => event.stopPropagation()}>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">
                    Review
                  </p>
                  <ReviewControls
                    due={problem.due}
                    flagged={problem.flagged}
                    revisionCount={problem.revisionCount}
                    onRevise={() => onRevise?.(problem.id)}
                    onToggleFlag={(next) => onToggleFlag?.(problem.id, next)}
                    disabled={disabled}
                    size="md"
                  />
                </div>
              )}

              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">Notes</p>
                <textarea
                  value={draftNote}
                  onChange={(event) => setDraftNote(event.target.value)}
                  onClick={(event) => event.stopPropagation()}
                  onBlur={() => onSaveNote(problem.id, draftNote)}
                  placeholder="Approach, edge cases, time complexity, gotchas…"
                  rows={3}
                  disabled={disabled}
                  className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600"
                />
                <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-1">
                  Full Markdown editing is available on the detail page.
                </p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-xs text-gray-400 dark:text-gray-500">
      · {label}{" "}
      <span className="font-medium text-gray-600 dark:text-gray-300">{value}</span>
    </span>
  );
}

/** 1 … 4 5 6 … 30 — always shows first, last and a window around current. */
function buildPagination(current: number, total: number): Array<number | "…"> {
  const pages = Array.from({ length: total }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === total || Math.abs(p - current) <= 1
  );

  return pages.reduce<Array<number | "…">>((acc, page, index, arr) => {
    if (index > 0 && page - arr[index - 1] > 1) acc.push("…");
    acc.push(page);
    return acc;
  }, []);
}
