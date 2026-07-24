"use client";
import { useMemo } from "react";
import { MASTERY_CONFIG } from "@/data/problems";

export default function StatsBar({ problems }) {
  const stats = useMemo(() => ({
    total:    problems.length,
    mastered: problems.filter(p => p.mastery === "mastered").length,
    familiar: problems.filter(p => p.mastery === "familiar").length,
    learning: problems.filter(p => p.mastery === "learning").length,
    unseen:   problems.filter(p => p.mastery === "unseen").length,
  }), [problems]);

  const solved  = stats.mastered + stats.familiar;
  const pct     = Math.round((solved / stats.total) * 100);
  const todayDone = solved % 5;
  const week    = Math.ceil((solved + 1) / 25) || 1;

  return (
    <div className="mb-5">
      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
        <span>{solved} / {stats.total} solved</span>
        <span className="font-semibold text-gray-700 dark:text-gray-300">{pct}%</span>
      </div>
      <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mb-3">
        <div className="h-full bg-green-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-950 border border-blue-100 dark:border-blue-900 rounded-xl px-4 py-2.5 mb-4">
        <div className="flex-1">
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">Week {week} · Today&apos;s target</p>
          <p className="text-xs text-blue-500">{todayDone}/5 problems done · {5 - todayDone} remaining</p>
        </div>
        <div className="flex gap-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={`w-3 h-3 rounded-full ${i < todayDone ? "bg-blue-500" : "bg-blue-200 dark:bg-blue-800"}`} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {Object.entries(MASTERY_CONFIG).reverse().map(([key, cfg]) => (
          <div key={key} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 transition-colors">
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{cfg.label}</p>
            <p className={`text-2xl font-bold ${cfg.textColor}`}>{stats[key]}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
