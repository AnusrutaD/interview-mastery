"use client";
import { formatClock, formatDuration } from "@/core/time/format";
import type { LastSession } from "@/features/progress/hooks/useProblemSession";
import type { UseSolveTimerResult } from "../hooks/useSolveTimer";
import { cn } from "@/lib/cn";

interface SolveTimerProps {
  timer: UseSolveTimerResult;
  totalTimeSeconds: number;
  attempts: number;
  lastSession: LastSession | null;
}

export function SolveTimer({ timer, totalTimeSeconds, attempts, lastSession }: SolveTimerProps) {
  const { running, elapsed, toggle, reset } = timer;

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
      {lastSession && <SessionBanner session={lastSession} />}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "w-2 h-2 rounded-full shrink-0",
              running ? "bg-green-500 animate-pulse" : "bg-gray-300 dark:bg-gray-600"
            )}
            aria-hidden
          />
          <div>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide">
              {running ? "Solving" : "Paused"}
            </p>
            <p
              className="text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100 leading-tight"
              aria-live="off"
            >
              {formatClock(elapsed)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggle}
            className={cn(
              "text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors",
              running
                ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60"
                : "bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/60"
            )}
          >
            {running ? "⏸ Pause" : "▶ Resume"}
          </button>
          <button
            type="button"
            onClick={reset}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            ↺ Reset
          </button>
        </div>

        <div className="flex items-center gap-4 ml-auto">
          {totalTimeSeconds > 0 && <Stat label="Total" value={formatDuration(totalTimeSeconds)} />}
          {attempts > 0 && <Stat label="Attempts" value={`${attempts}×`} />}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide">
        {label}
      </p>
      <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">{value}</p>
    </div>
  );
}

/**
 * Reports the outcome of the last attempt.
 *
 * `seconds === null` means the submission was real but we could not honestly
 * measure it — the page was not open for the whole attempt. We say so rather
 * than displaying a fabricated 0:00.
 */
function SessionBanner({ session }: { session: LastSession }) {
  const heading = session.source === "leetcode" ? "Accepted on LeetCode" : "Submitted";
  return (
    <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-xl">
      <span aria-hidden>✅</span>
      <p className="text-xs font-semibold text-green-700 dark:text-green-300">
        {heading}
        {session.seconds !== null ? (
          <>
            {" in "}
            <span className="tabular-nums">{formatClock(session.seconds)}</span>
          </>
        ) : (
          <span className="font-normal text-green-600/70 dark:text-green-400/70">
            {" · not timed on this page"}
          </span>
        )}
      </p>
      {session.source === "leetcode" && (
        <span className="text-[10px] text-green-600/70 dark:text-green-400/70 ml-auto shrink-0">
          auto-synced
        </span>
      )}
    </div>
  );
}
