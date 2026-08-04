"use client";
import { DIFFICULTIES, type Difficulty } from "@/core/domain/difficulty";
import { MASTERY_CONFIG, MASTERY_LEVELS, type MasteryLevel } from "@/core/domain/mastery";
import { catalog } from "@/data/catalog";
import { cn } from "@/lib/cn";

/** "All" is a UI-only sentinel; the domain types stay clean. */
export const ALL = "All" as const;
export type FilterValue<T extends string> = T | typeof ALL;

export interface ProblemFilterState {
  search: string;
  category: FilterValue<string>;
  difficulty: FilterValue<Difficulty>;
  mastery: FilterValue<MasteryLevel>;
  dueOnly: boolean;
  unsolvedOnly: boolean;
}

export const DEFAULT_FILTERS: ProblemFilterState = {
  search: "",
  category: ALL,
  difficulty: ALL,
  mastery: ALL,
  dueOnly: false,
  unsolvedOnly: false,
};

const inputCls =
  "border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-600 transition-colors";

export function ProblemFilters({
  value,
  onChange,
}: {
  value: ProblemFilterState;
  onChange: <K extends keyof ProblemFilterState>(key: K, next: ProblemFilterState[K]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 mb-3">
      <input
        type="search"
        placeholder="Search problems…"
        aria-label="Search problems"
        value={value.search}
        onChange={(e) => onChange("search", e.target.value)}
        className={cn("flex-1 min-w-40", inputCls)}
      />

      <select
        aria-label="Filter by category"
        value={value.category}
        onChange={(e) => onChange("category", e.target.value)}
        className={cn("flex-1 min-w-40", inputCls)}
      >
        <option value={ALL}>All categories</option>
        {catalog.categories().map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      <select
        aria-label="Filter by difficulty"
        value={value.difficulty}
        onChange={(e) => onChange("difficulty", e.target.value as FilterValue<Difficulty>)}
        className={inputCls}
      >
        <option value={ALL}>All difficulty</option>
        {DIFFICULTIES.map((d) => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>

      <select
        aria-label="Filter by mastery"
        value={value.mastery}
        onChange={(e) => onChange("mastery", e.target.value as FilterValue<MasteryLevel>)}
        className={inputCls}
      >
        <option value={ALL}>All mastery</option>
        {MASTERY_LEVELS.map((level) => (
          <option key={level} value={level}>{MASTERY_CONFIG[level].label}</option>
        ))}
      </select>

      <button
        type="button"
        aria-pressed={value.dueOnly}
        onClick={() => onChange("dueOnly", !value.dueOnly)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors font-medium",
          value.dueOnly
            ? "bg-red-500 border-red-500 text-white"
            : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-red-300 dark:hover:border-red-700 hover:text-red-500"
        )}
      >
        🔴 Due
      </button>

      <button
        type="button"
        aria-pressed={value.unsolvedOnly}
        onClick={() => onChange("unsolvedOnly", !value.unsolvedOnly)}
        title="Problems you attempted but couldn't solve"
        className={cn(
          "flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors font-medium",
          value.unsolvedOnly
            ? "bg-rose-600 border-rose-600 text-white"
            : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-rose-300 dark:hover:border-rose-700 hover:text-rose-500"
        )}
      >
        ✗ Unsolved
      </button>
    </div>
  );
}

/** Pure predicate so filtering is testable and shared across pages. */
export function applyFilters(
  problems: readonly import("@/core/domain/progress").ProblemWithProgress[],
  filters: ProblemFilterState
) {
  const query = filters.search.trim().toLowerCase();
  return problems.filter((p) => {
    if (filters.category !== ALL && p.category !== filters.category) return false;
    if (filters.difficulty !== ALL && p.difficulty !== filters.difficulty) return false;
    if (filters.mastery !== ALL && p.mastery !== filters.mastery) return false;
    if (filters.dueOnly && !p.due) return false;
    if (filters.unsolvedOnly && p.mastery !== "unsolved") return false;
    if (query) {
      return (
        p.title.toLowerCase().includes(query) || String(p.leetcode).includes(query)
      );
    }
    return true;
  });
}
