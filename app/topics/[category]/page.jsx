"use client";
import { useEffect, useState, useMemo, use } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { PROBLEMS, CATEGORY_ICONS, slugToCategory, MASTERY_CONFIG, MASTERY_ORDER, DIFF_CONFIG } from "@/data/problems";
import { isDue, reviewLabel } from "@/lib/spaced-repetition";

const DIFF_ORDER = ["Easy", "Medium", "Hard"];
const DIFF_COLOR_BAR = { Easy: "bg-green-500", Medium: "bg-yellow-500", Hard: "bg-red-500" };
const DIFF_COLOR_TEXT = {
  Easy:   "text-green-600 dark:text-green-400",
  Medium: "text-yellow-600 dark:text-yellow-400",
  Hard:   "text-red-600 dark:text-red-400",
};

export default function TopicStudyPage({ params }) {
  const { category: slug } = use(params);
  const { data: session, status } = useSession();
  const isLoggedIn = status === "authenticated";

  const category = slugToCategory(slug);

  const [progress,  setProgress]  = useState({});
  const [updatedAt, setUpdatedAt] = useState({});
  const [saving,    setSaving]    = useState(null); // problemId being saved

  useEffect(() => {
    if (!isLoggedIn) return;
    fetch("/api/progress")
      .then(r => r.json())
      .then(({ progress: p, updatedAt: u }) => {
        if (p) setProgress(p);
        if (u) setUpdatedAt(u);
      })
      .catch(console.error);
  }, [isLoggedIn]);

  const catProblems = useMemo(() => {
    if (!category) return [];
    return PROBLEMS
      .filter(p => p.category === category)
      .map(p => ({
        ...p,
        mastery: progress[p.id] || "unseen",
        due: isDue(progress[p.id], updatedAt[p.id]),
        updatedAt: updatedAt[p.id] || null,
      }))
      .sort((a, b) => DIFF_ORDER.indexOf(a.difficulty) - DIFF_ORDER.indexOf(b.difficulty));
  }, [category, progress, updatedAt]);

  const stats = useMemo(() => {
    const total  = catProblems.length;
    const solved = catProblems.filter(p => p.mastery !== "unseen").length;
    const due    = catProblems.filter(p => p.due).length;
    const pct    = total ? Math.round((solved / total) * 100) : 0;
    const byDiff = {};
    for (const d of DIFF_ORDER) {
      const dp = catProblems.filter(p => p.difficulty === d);
      byDiff[d] = { total: dp.length, solved: dp.filter(q => q.mastery !== "unseen").length };
    }
    return { total, solved, due, pct, byDiff };
  }, [catProblems]);

  // Next recommended problem: first due, else first unseen Easy, else first unseen any, else null
  const nextProblem = useMemo(() => {
    const due = catProblems.find(p => p.due);
    if (due) return due;
    const unseen = catProblems.find(p => p.mastery === "unseen" && p.difficulty === "Easy")
      || catProblems.find(p => p.mastery === "unseen");
    return unseen || null;
  }, [catProblems]);

  const updateMastery = async (id, level) => {
    setProgress(prev => ({ ...prev, [id]: level }));
    setSaving(id);
    try {
      const res = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemId: id, mastery: level }),
      });
      const data = await res.json();
      if (data.row?.updatedAt) {
        setUpdatedAt(prev => ({ ...prev, [id]: data.row.updatedAt }));
      }
    } catch (e) { console.error(e); }
    setSaving(null);
  };

  if (!category) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-2">Topic not found.</p>
          <Link href="/topics" className="text-sm text-blue-500 hover:underline">← Back to Topics</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-5 text-xs text-gray-400 dark:text-gray-500">
          <Link href="/" className="hover:text-blue-500 transition-colors">Dashboard</Link>
          <span>/</span>
          <Link href="/topics" className="hover:text-blue-500 transition-colors">Topics</Link>
          <span>/</span>
          <span className="text-gray-600 dark:text-gray-300 font-medium">{category}</span>
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <span className="text-4xl">{CATEGORY_ICONS[category] || "📌"}</span>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{category}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{stats.solved}/{stats.total} solved</p>
          </div>
        </div>

        {/* Progress dashboard */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 mb-4">
          {/* Overall bar */}
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Overall Progress</span>
            <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{stats.pct}%</span>
          </div>
          <div className="h-2.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mb-4">
            <div
              className={`h-full rounded-full transition-all duration-500 ${stats.pct === 100 ? "bg-green-500" : "bg-blue-500"}`}
              style={{ width: `${stats.pct}%` }}
            />
          </div>

          {/* Per-difficulty breakdown */}
          <div className="grid grid-cols-3 gap-3">
            {DIFF_ORDER.map(d => {
              const { total: dt, solved: ds } = stats.byDiff[d] || { total: 0, solved: 0 };
              if (dt === 0) return null;
              const pct = Math.round((ds / dt) * 100);
              return (
                <div key={d}>
                  <div className="flex justify-between mb-1">
                    <span className={`text-xs font-semibold ${DIFF_COLOR_TEXT[d]}`}>{d}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-600">{ds}/{dt}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div className={`h-full ${DIFF_COLOR_BAR[d]} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {stats.due > 0 && (
            <p className="text-xs font-semibold text-red-500 dark:text-red-400 mt-3">
              🔴 {stats.due} problem{stats.due !== 1 ? "s" : ""} due for review
            </p>
          )}
        </div>

        {/* Next problem highlight */}
        {nextProblem && (
          <div className={`rounded-2xl border p-4 mb-4 ${
            nextProblem.due
              ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
              : "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800"
          }`}>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
              {nextProblem.due ? "🔴 Due for Review" : "▶ Next Problem"}
            </p>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{nextProblem.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs font-medium ${DIFF_COLOR_TEXT[nextProblem.difficulty]}`}>
                    {nextProblem.difficulty}
                  </span>
                  <span className="text-[10px] text-gray-400">LC #{nextProblem.leetcode}</span>
                  {nextProblem.due && (
                    <span className="text-[10px] font-semibold text-red-500 dark:text-red-400">
                      {reviewLabel(nextProblem.mastery, nextProblem.updatedAt)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Link
                  href={`/problems/${nextProblem.id}`}
                  className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition-colors"
                >
                  Detail →
                </Link>
                <a
                  href={nextProblem.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg transition-colors"
                >
                  LeetCode →
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Problem list */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">All Problems</h2>
          </div>

          {catProblems.map((problem, idx) => {
            const diff = DIFF_CONFIG[problem.difficulty];
            const mst  = MASTERY_CONFIG[problem.mastery];
            const isLast = idx === catProblems.length - 1;

            return (
              <div
                key={problem.id}
                className={`px-4 py-3 ${!isLast ? "border-b border-gray-100 dark:border-gray-800" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-400 dark:text-gray-600 font-mono">#{problem.id}</span>
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${diff.bgColor} ${diff.textColor}`}>
                        {problem.difficulty}
                      </span>
                      {problem.due && (
                        <span className="text-[10px] font-semibold bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-full">
                          {reviewLabel(problem.mastery, problem.updatedAt)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mt-0.5 leading-snug">
                      {problem.title}
                    </p>

                    {/* Inline mastery selector */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {MASTERY_ORDER.map(level => {
                        const cfg = MASTERY_CONFIG[level];
                        const active = problem.mastery === level;
                        return (
                          <button
                            key={level}
                            onClick={() => updateMastery(problem.id, level)}
                            disabled={!isLoggedIn || saving === problem.id}
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all ${
                              active
                                ? `${cfg.bgColor} ${cfg.textColor} border-current scale-105`
                                : "bg-white dark:bg-gray-900 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                            }`}
                          >
                            {saving === problem.id && active ? "…" : cfg.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex gap-2 shrink-0 mt-0.5">
                    <Link
                      href={`/problems/${problem.id}`}
                      className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                    >
                      Detail →
                    </Link>
                    <a
                      href={problem.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-orange-500 hover:text-orange-600 dark:text-orange-400 dark:hover:text-orange-300 transition-colors"
                    >
                      LC →
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
