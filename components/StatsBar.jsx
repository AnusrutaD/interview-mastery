"use client";
import { useMemo, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { MASTERY_CONFIG } from "@/data/problems";
import { getISTMidnight } from "@/lib/timezone";

export default function StatsBar({ problems }) {
  const { status } = useSession();
  const [dailyGoal, setDailyGoal] = useState(null);

  // Fetch daily goal only (solved today is computed client-side for correct timezone)
  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/user/settings")
      .then(r => r.json())
      .then(d => setDailyGoal(d.dailyGoal ?? 3))
      .catch(() => {});
  }, [status]);

  const stats = useMemo(() => {
    const todayStart = getISTMidnight();

    return {
      total:       problems.length,
      mastered:    problems.filter(p => p.mastery === "mastered").length,
      familiar:    problems.filter(p => p.mastery === "familiar").length,
      learning:    problems.filter(p => p.mastery === "learning").length,
      unseen:      problems.filter(p => p.mastery === "unseen").length,
      // Only count problems where mastery was updated today (local time)
      solvedToday: problems.filter(
        p => p.mastery !== "unseen" && p.updatedAt && new Date(p.updatedAt) >= todayStart
      ).length,
    };
  }, [problems]);

  const attempted = stats.mastered + stats.familiar + stats.learning;
  const pct = Math.round((attempted / stats.total) * 100);

  // Daily goal progress
  const goalCount = dailyGoal ?? 3;
  const todayCount = stats.solvedToday;
  const goalPct = Math.min(100, Math.round((todayCount / goalCount) * 100));
  const goalDone = todayCount >= goalCount;

  return (
    <div className="mb-5">
      {/* Overall progress bar */}
      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
        <span>{attempted} / {stats.total} attempted</span>
        <span className="font-semibold text-gray-700 dark:text-gray-300">{pct}%</span>
      </div>
      <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mb-3">
        <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      {/* Daily goal — only shown when logged in and data is loaded */}
      {status === "authenticated" && dailyGoal !== null && (
        <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-950 border border-blue-100 dark:border-blue-900 rounded-xl px-4 py-2.5 mb-4">
          <div className="flex-1">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">
              {goalDone ? "🎉 Daily goal complete!" : "Today's goal"}
            </p>
            <p className="text-xs text-blue-500 dark:text-blue-400">
              {todayCount} / {goalCount} problems · {goalPct}% done
            </p>
          </div>
          <div className="flex gap-1.5">
            {Array.from({ length: goalCount }).map((_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full transition-colors ${
                  i < todayCount ? "bg-blue-500" : "bg-blue-200 dark:bg-blue-800"
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Mastery breakdown */}
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
