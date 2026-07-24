"use client";
import { useState } from "react";
import Link from "next/link";
import { MASTERY_CONFIG, MASTERY_ORDER, DIFF_CONFIG } from "@/data/problems";
import { reviewLabel } from "@/lib/spaced-repetition";

function ProblemRow({ problem, onSetMastery, onSaveNote, note }) {
  const [open, setOpen] = useState(false);
  const [localNote, setLocalNote] = useState(note || "");
  const diff = DIFF_CONFIG[problem.difficulty];
  const mst = MASTERY_CONFIG[problem.mastery];

  return (
    <>
      <tr
        onClick={() => setOpen(o => !o)}
        className={`border-b border-gray-100 dark:border-gray-800 cursor-pointer transition-colors ${
          open ? "bg-blue-50 dark:bg-blue-950/40" : "hover:bg-gray-50 dark:hover:bg-gray-900"
        }`}
      >
        <td className="px-3 py-3 text-gray-400 dark:text-gray-600 text-xs">{problem.id}</td>
        <td className="px-3 py-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-800 dark:text-gray-200 text-sm leading-snug">{problem.title}</span>
            {problem.due && (
              <span className="text-[10px] font-semibold bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-full shrink-0">
                {reviewLabel(problem.mastery, problem.updatedAt)}
              </span>
            )}
          </div>
          <span className="text-xs text-gray-400 dark:text-gray-500 sm:hidden">{problem.difficulty}</span>
        </td>
        <td className="px-3 py-3 hidden sm:table-cell">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${diff.bgColor} ${diff.textColor}`}>
            {problem.difficulty}
          </span>
        </td>
        <td className="px-3 py-3">
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${mst.bgColor} ${mst.textColor}`}>
            {mst.label}
          </span>
        </td>
        <td className="px-3 py-3 text-center text-gray-400 dark:text-gray-600 text-xs">
          {open ? "▲" : "▼"}
        </td>
      </tr>

      {open && (
        <tr className="border-b border-blue-100 dark:border-blue-900">
          <td colSpan={5} className="px-4 py-4 bg-blue-50/40 dark:bg-blue-950/20">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-full">{problem.category}</span>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${diff.bgColor} ${diff.textColor}`}>{problem.difficulty}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500">LC #{problem.leetcode}</span>
                <div className="ml-auto flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <Link
                    href={`/problems/${problem.id}`}
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
                <div className="flex flex-wrap gap-2">
                  {MASTERY_ORDER.map(level => {
                    const cfg = MASTERY_CONFIG[level];
                    const active = problem.mastery === level;
                    return (
                      <button
                        key={level}
                        onClick={e => { e.stopPropagation(); onSetMastery(problem.id, level); }}
                        className={`text-xs font-medium px-3 py-1.5 rounded-full border-2 transition-all ${
                          active
                            ? `${cfg.bgColor} ${cfg.textColor} border-current scale-105`
                            : "bg-white dark:bg-gray-900 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                        }`}
                      >
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">Notes</p>
                <textarea
                  value={localNote}
                  onChange={e => setLocalNote(e.target.value)}
                  onClick={e => e.stopPropagation()}
                  onBlur={() => onSaveNote(problem.id, localNote)}
                  placeholder="Approach, edge cases, time complexity, gotchas…"
                  rows={3}
                  className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600"
                />
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function ProblemTable({ problems, onSetMastery, onSaveNote, notes, page, setPage }) {
  const PAGE_SIZE = 5;
  const totalPages = Math.ceil(problems.length / PAGE_SIZE);
  const safePage = Math.min(page, totalPages || 1);
  const paged = problems.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const week = Math.ceil(safePage / 5);
  const dayInWeek = ((safePage - 1) % 5) + 1;
  const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

  if (problems.length === 0) {
    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-12 text-center text-gray-400 dark:text-gray-500 text-sm">
        No problems match your filters
      </div>
    );
  }

  const pageNums = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
    .reduce((acc, p, i, arr) => {
      if (i > 0 && p - arr[i - 1] > 1) acc.push("…");
      acc.push(p);
      return acc;
    }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold bg-blue-600 text-white px-2.5 py-1 rounded-full">Week {week}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{DAY_NAMES[dayInWeek - 1]} · Day {safePage}</span>
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, problems.length)} of {problems.length}
        </span>
      </div>

      <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden mb-4 bg-white dark:bg-gray-900 transition-colors">
        <table className="w-full text-sm border-collapse table-fixed">
          <colgroup>
            <col style={{ width: "2.5rem" }} />
            <col />
            <col style={{ width: "6rem" }} className="hidden sm:table-column" />
            <col style={{ width: "7rem" }} />
            <col style={{ width: "2rem" }} />
          </colgroup>
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">#</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Problem</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 hidden sm:table-cell">Difficulty</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Mastery</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {paged.map(p => (
              <ProblemRow key={p.id} problem={p} onSetMastery={onSetMastery} onSaveNote={onSaveNote} note={notes[p.id] || ""} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={safePage === 1}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          ← Prev
        </button>

        <div className="flex items-center gap-1 flex-wrap justify-center">
          {pageNums.map((p, i) =>
            p === "…" ? (
              <span key={`e-${i}`} className="px-1 text-gray-400 text-xs">…</span>
            ) : (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-8 h-8 text-xs rounded-lg font-semibold transition-colors ${
                  p === safePage
                    ? "bg-blue-600 text-white"
                    : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                {p}
              </button>
            )
          )}
        </div>

        <button
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={safePage === totalPages}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
