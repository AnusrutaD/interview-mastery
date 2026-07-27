"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { PROBLEMS, CATEGORY_ICONS, categoryToSlug } from "@/data/problems";
import { isDue } from "@/lib/spaced-repetition";

const ALL_CATEGORIES = Array.from(new Set(PROBLEMS.map(p => p.category)));

const DIFF_ORDER = ["Easy", "Medium", "Hard"];
const DIFF_COLOR = {
  Easy:   { bar: "bg-green-500",  text: "text-green-600 dark:text-green-400"  },
  Medium: { bar: "bg-yellow-500", text: "text-yellow-600 dark:text-yellow-400" },
  Hard:   { bar: "bg-red-500",    text: "text-red-600 dark:text-red-400"       },
};

function MiniBar({ pct, color }) {
  return (
    <div className="h-1 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function TopicsPage() {
  const { data: session, status } = useSession();
  const isLoggedIn = status === "authenticated";

  const [progress,  setProgress]  = useState({});
  const [updatedAt, setUpdatedAt] = useState({});

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

  const topics = useMemo(() => {
    return ALL_CATEGORIES.map(cat => {
      const catProblems = PROBLEMS.filter(p => p.category === cat).map(p => ({
        ...p,
        mastery: progress[p.id] || "unseen",
        due: isDue(progress[p.id], updatedAt[p.id]),
      }));

      const total   = catProblems.length;
      const solved  = catProblems.filter(p => p.mastery !== "unseen").length;
      const due     = catProblems.filter(p => p.due).length;
      const pct     = total ? Math.round((solved / total) * 100) : 0;

      const byDiff = {};
      for (const d of DIFF_ORDER) {
        const dp = catProblems.filter(p => p.difficulty === d);
        byDiff[d] = { total: dp.length, solved: dp.filter(p => p.mastery !== "unseen").length };
      }

      return { cat, total, solved, due, pct, byDiff, slug: categoryToSlug(cat) };
    });
  }, [progress, updatedAt]);

  const totalSolved  = Object.values(progress).filter(v => v && v !== "unseen").length;
  const totalDue     = topics.reduce((s, t) => s + t.due, 0);
  const completedCats = topics.filter(t => t.pct === 100).length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">

        {/* Header */}
        <div className="mb-6">
          <Link href="/" className="text-xs text-gray-400 dark:text-gray-500 hover:text-blue-500 transition-colors">
            ← Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">Topics</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Study NeetCode 150 by category
          </p>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "Attempted",        value: totalSolved,   suffix: "/ 150" },
            { label: "Due for review",   value: totalDue,      suffix: "problems" },
            { label: "Topics complete",  value: completedCats, suffix: `/ ${ALL_CATEGORIES.length}` },
          ].map(({ label, value, suffix }) => (
            <div key={label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 text-center">
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500">{suffix}</p>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Topic cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {topics.map(({ cat, total, solved, due, pct, byDiff, slug }) => (
            <Link
              key={cat}
              href={`/topics/${slug}`}
              className="group bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 rounded-2xl p-4 transition-all hover:shadow-sm"
            >
              {/* Top row */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{CATEGORY_ICONS[cat] || "📌"}</span>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-tight">
                      {cat}
                    </h3>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">{total} problems</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-none">{pct}%</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">{solved}/{total}</p>
                </div>
              </div>

              {/* Main progress bar */}
              <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mb-3">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? "bg-green-500" : "bg-blue-500"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              {/* Difficulty breakdown */}
              <div className="flex gap-3">
                {DIFF_ORDER.map(d => {
                  const { total: dt, solved: ds } = byDiff[d] || { total: 0, solved: 0 };
                  if (dt === 0) return null;
                  return (
                    <div key={d} className="flex-1">
                      <div className="flex justify-between mb-0.5">
                        <span className={`text-[10px] font-medium ${DIFF_COLOR[d].text}`}>{d[0]}</span>
                        <span className="text-[10px] text-gray-400 dark:text-gray-600">{ds}/{dt}</span>
                      </div>
                      <MiniBar pct={dt ? Math.round((ds / dt) * 100) : 0} color={DIFF_COLOR[d].bar} />
                    </div>
                  );
                })}
              </div>

              {/* Due badge */}
              {due > 0 && (
                <p className="text-[10px] font-semibold text-red-500 dark:text-red-400 mt-2">
                  🔴 {due} due for review
                </p>
              )}
              {pct === 100 && (
                <p className="text-[10px] font-semibold text-green-600 dark:text-green-400 mt-2">
                  ✅ Complete
                </p>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
