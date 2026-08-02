/**
 * Filtering for any list of study items.
 *
 * The central idea is that filters are **derived from the data**, not declared
 * up front. A coding list has difficulties and topics; a YouTube playlist has
 * neither but does have durations. Hard-coding one set of controls means half
 * of them are empty and useless on any given list.
 *
 * So `deriveFacets` inspects the actual items and reports what is worth
 * filtering on, and the UI renders only those controls. The rule throughout:
 * **a filter offering a single option is noise, not a feature.**
 */
import type { ItemKind, ItemWithProgress } from "./collection";
import { MASTERY_LEVELS, type MasteryLevel } from "./mastery";

/** UI-only sentinel so the domain types stay clean. */
export const ALL = "All" as const;
export type Filterable<T extends string> = T | typeof ALL;

export interface ItemFilterState {
  search: string;
  difficulty: Filterable<string>;
  topic: Filterable<string>;
  kind: Filterable<ItemKind>;
  mastery: Filterable<MasteryLevel>;
  dueOnly: boolean;
  unsolvedOnly: boolean;
}

export const DEFAULT_ITEM_FILTERS: ItemFilterState = {
  search: "",
  difficulty: ALL,
  topic: ALL,
  kind: ALL,
  mastery: ALL,
  dueOnly: false,
  unsolvedOnly: false,
};

/** What a given list of items can meaningfully be filtered by. */
export interface ItemFacets {
  /** Distinct difficulties present, in the conventional order. */
  difficulties: string[];
  topics: string[];
  kinds: ItemKind[];
  masteries: MasteryLevel[];
  /** True when at least one item is currently due. */
  hasDue: boolean;
  /** True when at least one item is marked unsolved. */
  hasUnsolved: boolean;
  /** Worth offering search at all — a five-item list does not need it. */
  worthSearching: boolean;
}

const DIFFICULTY_ORDER = ["Easy", "Medium", "Hard"];
/** Below this, scrolling beats searching. */
const SEARCH_THRESHOLD = 8;

function distinct(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v && v.trim())))];
}

export function deriveFacets(items: readonly ItemWithProgress[]): ItemFacets {
  const difficulties = distinct(items.map((i) => i.difficulty)).sort((a, b) => {
    const ai = DIFFICULTY_ORDER.indexOf(a);
    const bi = DIFFICULTY_ORDER.indexOf(b);
    // Unrecognised values sort last but stay stable among themselves.
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  const topics = distinct(items.map((i) => i.topic)).sort((a, b) => a.localeCompare(b));
  const kinds = [...new Set(items.map((i) => i.kind))];
  const masteries = MASTERY_LEVELS.filter((level) => items.some((i) => i.mastery === level));

  return {
    // A facet with one distinct value cannot narrow anything, so it is not
    // offered — this is what keeps an empty "Difficulty" dropdown off a playlist.
    difficulties: difficulties.length > 1 ? difficulties : [],
    topics: topics.length > 1 ? topics : [],
    kinds: kinds.length > 1 ? kinds : [],
    masteries: masteries.length > 1 ? masteries : [],
    hasDue: items.some((i) => i.due),
    hasUnsolved: items.some((i) => i.mastery === "unsolved"),
    worthSearching: items.length >= SEARCH_THRESHOLD,
  };
}

/** Does this list need any filter UI at all? */
export function hasAnyFacet(facets: ItemFacets): boolean {
  return (
    facets.difficulties.length > 0 ||
    facets.topics.length > 0 ||
    facets.kinds.length > 0 ||
    facets.masteries.length > 0 ||
    facets.hasDue ||
    facets.hasUnsolved ||
    facets.worthSearching
  );
}

/** True when anything is actively narrowing the list. */
export function isFiltering(filters: ItemFilterState): boolean {
  return (
    filters.search.trim() !== "" ||
    filters.difficulty !== ALL ||
    filters.topic !== ALL ||
    filters.kind !== ALL ||
    filters.mastery !== ALL ||
    filters.dueOnly ||
    filters.unsolvedOnly
  );
}

/**
 * Apply the filters.
 *
 * Search matches title, topic and external id, so pasting a LeetCode slug or a
 * YouTube video id finds the item. Matching is case-insensitive and substring
 * based — deliberately forgiving, since this is a find-my-thing box rather
 * than a query language.
 */
export function applyItemFilters(
  items: readonly ItemWithProgress[],
  filters: ItemFilterState
): ItemWithProgress[] {
  const query = filters.search.trim().toLowerCase();

  return items.filter((item) => {
    if (filters.difficulty !== ALL && item.difficulty !== filters.difficulty) return false;
    if (filters.topic !== ALL && item.topic !== filters.topic) return false;
    if (filters.kind !== ALL && item.kind !== filters.kind) return false;
    if (filters.mastery !== ALL && item.mastery !== filters.mastery) return false;
    if (filters.dueOnly && !item.due) return false;
    if (filters.unsolvedOnly && item.mastery !== "unsolved") return false;

    if (query) {
      const haystack = [item.title, item.topic, item.externalId]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    return true;
  });
}

/**
 * Drop any filter the current items can no longer satisfy.
 *
 * Without this, deleting the last Hard problem leaves the list filtered to
 * "Hard" and apparently empty, with no obvious way back.
 */
export function reconcileFilters(
  filters: ItemFilterState,
  facets: ItemFacets
): ItemFilterState {
  return {
    ...filters,
    difficulty: facets.difficulties.includes(filters.difficulty as string)
      ? filters.difficulty
      : ALL,
    topic: facets.topics.includes(filters.topic as string) ? filters.topic : ALL,
    kind: facets.kinds.includes(filters.kind as ItemKind) ? filters.kind : ALL,
    mastery: facets.masteries.includes(filters.mastery as MasteryLevel)
      ? filters.mastery
      : ALL,
    dueOnly: filters.dueOnly && facets.hasDue,
    unsolvedOnly: filters.unsolvedOnly && facets.hasUnsolved,
  };
}
