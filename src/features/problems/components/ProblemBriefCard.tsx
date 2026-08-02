import type { ProblemBrief } from "@/core/domain/progress";
import { Card } from "@/components/ui/Card";

/**
 * The condensed brief shown above the fold on a problem page.
 *
 * `insight` is collapsed behind a disclosure by default: on a first attempt you
 * want the task without being handed the answer, but on a review two months
 * later the insight is the whole reason you came back.
 */
export function ProblemBriefCard({ brief }: { brief: ProblemBrief }) {
  return (
    <Card className="mb-4">
      <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">
        In brief
      </p>

      <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">{brief.task}</p>

      <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
        <span className="font-semibold text-gray-500 dark:text-gray-400">Target:</span>{" "}
        <span className="font-mono">{brief.complexity}</span>
      </p>

      <details className="group mt-3">
        <summary className="cursor-pointer list-none text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">
          <span className="group-open:hidden">💡 Show the key insight</span>
          <span className="hidden group-open:inline">Hide insight</span>
        </summary>

        <div className="mt-2.5 pl-3 border-l-2 border-blue-200 dark:border-blue-800 flex flex-col gap-2">
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
            {brief.insight}
          </p>
          {brief.pitfall && (
            <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
              <span className="font-semibold">Watch out:</span> {brief.pitfall}
            </p>
          )}
        </div>
      </details>

      <p className="text-[10px] text-gray-300 dark:text-gray-700 mt-3">
        Summary written for this app — open LeetCode for the full statement, examples and
        constraints.
      </p>
    </Card>
  );
}
