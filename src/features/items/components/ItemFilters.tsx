"use client";
import { ITEM_KIND_CONFIG } from "@/core/domain/collection";
import {
  ALL,
  hasAnyFacet,
  isFiltering,
  type ItemFacets,
  type ItemFilterState,
} from "@/core/domain/itemFilter";
import { MASTERY_CONFIG } from "@/core/domain/mastery";
import { cn } from "@/lib/cn";

const inputCls =
  "border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-600 transition-colors";

/**
 * Filter bar that renders only the controls the current list can actually use.
 *
 * `facets` is derived from the items themselves, so a YouTube playlist gets a
 * search box and a mastery filter but no difficulty dropdown, while a coding
 * list gets the full set. Nothing is hard-coded per list type — add a new kind
 * of content and the right controls appear on their own.
 */
export function ItemFilters({
  value,
  facets,
  onChange,
  onReset,
  resultCount,
  totalCount,
}: {
  value: ItemFilterState;
  facets: ItemFacets;
  onChange: <K extends keyof ItemFilterState>(key: K, next: ItemFilterState[K]) => void;
  onReset: () => void;
  resultCount: number;
  totalCount: number;
}) {
  // Nothing worth filtering on — render nothing rather than an empty toolbar.
  if (!hasAnyFacet(facets)) return null;

  const filtering = isFiltering(value);

  return (
    <div className="mb-3">
      <div className="flex flex-wrap gap-2">
        {facets.worthSearching && (
          <input
            type="search"
            placeholder="Search…"
            aria-label="Search items"
            value={value.search}
            onChange={(e) => onChange("search", e.target.value)}
            className={cn("flex-1 min-w-44", inputCls)}
          />
        )}

        {facets.difficulties.length > 0 && (
          <select
            aria-label="Filter by difficulty"
            value={value.difficulty}
            onChange={(e) => onChange("difficulty", e.target.value)}
            className={inputCls}
          >
            <option value={ALL}>All difficulty</option>
            {facets.difficulties.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        )}

        {facets.topics.length > 0 && (
          <select
            aria-label="Filter by topic"
            value={value.topic}
            onChange={(e) => onChange("topic", e.target.value)}
            className={cn("max-w-48", inputCls)}
          >
            <option value={ALL}>All topics</option>
            {facets.topics.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}

        {facets.kinds.length > 0 && (
          <select
            aria-label="Filter by type"
            value={value.kind}
            onChange={(e) => onChange("kind", e.target.value as ItemFilterState["kind"])}
            className={inputCls}
          >
            <option value={ALL}>All types</option>
            {facets.kinds.map((k) => (
              <option key={k} value={k}>
                {ITEM_KIND_CONFIG[k].label}
              </option>
            ))}
          </select>
        )}

        {facets.masteries.length > 0 && (
          <select
            aria-label="Filter by mastery"
            value={value.mastery}
            onChange={(e) => onChange("mastery", e.target.value as ItemFilterState["mastery"])}
            className={inputCls}
          >
            <option value={ALL}>All mastery</option>
            {facets.masteries.map((m) => (
              <option key={m} value={m}>
                {MASTERY_CONFIG[m].label}
              </option>
            ))}
          </select>
        )}

        {facets.hasDue && (
          <Toggle
            active={value.dueOnly}
            onClick={() => onChange("dueOnly", !value.dueOnly)}
            activeClass="bg-red-500 border-red-500 text-white"
            hoverClass="hover:border-red-300 dark:hover:border-red-700 hover:text-red-500"
          >
            🔴 Due
          </Toggle>
        )}

        {facets.hasUnsolved && (
          <Toggle
            active={value.unsolvedOnly}
            onClick={() => onChange("unsolvedOnly", !value.unsolvedOnly)}
            activeClass="bg-rose-600 border-rose-600 text-white"
            hoverClass="hover:border-rose-300 dark:hover:border-rose-700 hover:text-rose-500"
          >
            ✗ Unsolved
          </Toggle>
        )}
      </div>

      {filtering && (
        <div className="flex items-center gap-2 mt-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Showing <strong>{resultCount}</strong> of {totalCount}
          </p>
          <button
            type="button"
            onClick={onReset}
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}

function Toggle({
  children,
  active,
  onClick,
  activeClass,
  hoverClass,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  activeClass: string;
  hoverClass: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors font-medium",
        active
          ? activeClass
          : cn(
              "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400",
              hoverClass
            )
      )}
    >
      {children}
    </button>
  );
}
