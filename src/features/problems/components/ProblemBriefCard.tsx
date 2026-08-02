import type { ProblemBrief } from "@/core/domain/progress";
import { Card } from "@/components/ui/Card";

/**
 * The self-contained brief shown on a problem page.
 *
 * Task, signature, example and constraints are visible immediately — that is
 * everything needed to attempt the problem without opening another tab. The
 * insight and pitfall sit behind a disclosure: on a first attempt you want the
 * problem, not the answer; on a review months later the insight is the whole
 * reason you came back.
 */
export function ProblemBriefCard({ brief }: { brief: ProblemBrief }) {
  return (
    <Card className="mb-4">
      <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">
        The problem
      </p>

      <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">{brief.task}</p>

      <pre className="mt-3 text-xs font-mono bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 overflow-x-auto text-gray-700 dark:text-gray-300">
        {brief.signature}
      </pre>

      <div className="mt-3 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide px-3 py-1.5 bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
          Example
        </p>
        <dl className="px-3 py-2 text-xs flex flex-col gap-1">
          <div className="flex gap-2">
            <dt className="text-gray-400 dark:text-gray-600 w-14 shrink-0">Input</dt>
            <dd className="font-mono text-gray-700 dark:text-gray-300 break-all">
              {brief.example.input}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-gray-400 dark:text-gray-600 w-14 shrink-0">Output</dt>
            <dd className="font-mono font-semibold text-green-700 dark:text-green-400 break-all">
              {brief.example.output}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-gray-400 dark:text-gray-600 w-14 shrink-0">Why</dt>
            <dd className="text-gray-600 dark:text-gray-400 leading-relaxed">
              {brief.example.why}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-3">
        <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5">
          Constraints
        </p>
        <ul className="flex flex-col gap-1">
          {brief.constraints.map((constraint) => (
            <li
              key={constraint}
              className="text-xs text-gray-600 dark:text-gray-400 flex gap-2 leading-relaxed"
            >
              <span className="text-gray-300 dark:text-gray-700 shrink-0" aria-hidden>
                ·
              </span>
              {constraint}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
        <span className="font-semibold text-gray-500 dark:text-gray-400">Target:</span>{" "}
        <span className="font-mono">{brief.complexity}</span>
      </p>

      <details className="group mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
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
        Written for this app. Open LeetCode to run your solution against the judge.
      </p>
    </Card>
  );
}
