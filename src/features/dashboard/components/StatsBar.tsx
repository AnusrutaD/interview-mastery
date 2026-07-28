"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { MASTERY_CONFIG, MASTERY_LEVELS } from "@/core/domain/mastery";
import type { ProgressStats } from "@/core/domain/progress";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { get } from "@/lib/http";
import { cn } from "@/lib/cn";

const DEFAULT_GOAL = 3;

/**
 * Stats are passed in, already derived by `summarize()`. This component no
 * longer recomputes "solved today" itself — that logic lives in the domain
 * layer so the dashboard, profile and API cannot disagree.
 */
export function StatsBar({ stats }: { stats: ProgressStats }) {
  const { status } = useSession();
  const [dailyGoal, setDailyGoal] = useState<number | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    get<{ dailyGoal: number }>("/api/user/settings")
      .then((d) => {
        if (!cancelled) setDailyGoal(d.dailyGoal ?? DEFAULT_GOAL);
      })
      .catch(() => {
        if (!cancelled) setDailyGoal(DEFAULT_GOAL);
      });
    return () => {
      cancelled = true;
    };
  }, [status]);

  const goal = dailyGoal ?? DEFAULT_GOAL;
  const done = stats.solvedToday >= goal;
  const goalPercent = Math.min(100, Math.round((stats.solvedToday / goal) * 100));

  return (
    <div className="mb-5">
      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
        <span>
          {stats.attempted} / {stats.total} attempted
        </span>
        <span className="font-semibold text-gray-700 dark:text-gray-300">
          {stats.completionPercent}%
        </span>
      </div>
      <ProgressBar value={stats.attempted} max={stats.total} height="h-2.5" className="mb-3" />

      {status === "authenticated" && dailyGoal !== null && (
        <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-950 border border-blue-100 dark:border-blue-900 rounded-xl px-4 py-2.5 mb-4">
          <div className="flex-1">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">
              {done ? "🎉 Daily goal complete!" : "Today's goal"}
            </p>
            <p className="text-xs text-blue-500 dark:text-blue-400">
              {stats.solvedToday} / {goal} problems · {goalPercent}% done
            </p>
          </div>
          <div className="flex gap-1.5" aria-hidden>
            {Array.from({ length: goal }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  "w-3 h-3 rounded-full transition-colors",
                  i < stats.solvedToday ? "bg-blue-500" : "bg-blue-200 dark:bg-blue-800"
                )}
              />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[...MASTERY_LEVELS].reverse().map((level) => {
          const cfg = MASTERY_CONFIG[level];
          return (
            <div
              key={level}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3"
            >
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{cfg.label}</p>
              <p className={cn("text-2xl font-bold", cfg.textColor, cfg.darkTextColor)}>
                {stats.byMastery[level]}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
