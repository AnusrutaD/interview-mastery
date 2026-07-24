"use client";
import { useMemo } from "react";
import { MASTERY_CONFIG } from "@/data/problems";

export default function StatsBar({ problems }) {
  const stats = useMemo(() => ({
    total: problems.length,
    mastered: problems.filter(p => p.mastery === "mastered").length,
    familiar: problems.filter(p => p.mastery === "familiar").length,
    learning: problems.filter(p => p.mastery === "learning").length,
    unseen: problems.filter(p => p.mastery === "unseen").length,
  }), [problems]);

  const solved = stats.mastered + stats.familiar;
  const pct = Math.round((solved / stats.total) * 100);

  return (
    <div className="mb-6">
      {/* Progress bar */}
      <div className="flex justify-between text-sm text-gray-500 mb-1">
        <span>{solved} of {stats.total} solved</span>
        <span className="font-medium text-gray-700">{pct}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden border border-gray-200 mb-4">
        <div
          className="h-full bg-green-500 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(MASTERY_CONFIG).reverse().map(([key, cfg]) => (
          <div key={key} className="bg-white border border-gray-200 rounded-xl p-3">
            <p className="text-xs text-gray-500 mb-1">{cfg.label}</p>
            <p className={`text-2xl font-medium ${cfg.textColor}`}>{stats[key]}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
