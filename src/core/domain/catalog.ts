/**
 * The problem catalogue, as an abstraction.
 *
 * WHY THIS EXISTS
 *
 * The DSA track was built against a hardcoded array whose `id` field carried
 * four separate responsibilities at once: identity, curriculum order, the
 * foreign key for briefs and progress, and the URL. Any one change — insert a
 * problem, reorder two, remove one — forced the other three to move, and
 * renumbering silently repoints every brief and every progress row at the wrong
 * problem. That is a single-responsibility failure sitting in the data model,
 * where it does the most damage.
 *
 * Fourteen modules imported that array directly, so there was also nowhere to
 * stand: no seam at which a database-backed catalogue could replace the static
 * one. This port is that seam.
 *
 * THE CONTRACT
 *
 *   - `slug` is identity. Stable, human-meaningful, and the same key LeetCode
 *     and the Chrome extension already use. It never changes and never implies
 *     an order.
 *   - `order` is presentation. A number that may be rewritten freely, because
 *     nothing else is keyed on it.
 *   - `legacyId` exists only to resolve pre-existing briefs and bookmarks
 *     written against the old integer scheme. New entries need not have one.
 *
 * Separating those three is the whole point. Adapters may store them however
 * they like; consumers may only rely on this contract.
 */
import type { Difficulty } from "./difficulty";

/** A catalogue entry. Reference data — never the user's progress. */
export interface CatalogProblem {
  /** Stable identity. The LeetCode slug, e.g. "two-sum". */
  slug: string;
  title: string;
  difficulty: Difficulty;
  category: string;
  /** LeetCode's displayed number, e.g. "217". Presentation only. */
  leetcode: string;
  url: string;
  /**
   * Curriculum position. Freely rewritable — no other field is derived from it,
   * which is precisely what the old integer `id` got wrong.
   */
  order: number;
  /**
   * The pre-refactor integer id, where one exists.
   *
   * Kept so briefs authored against the old scheme and any bookmarked
   * `/problems/12` URL still resolve. A problem the user adds themselves has no
   * legacy id, and that is not an error.
   */
  legacyId?: number;
}

export interface CatalogNeighbours {
  previous: CatalogProblem | null;
  next: CatalogProblem | null;
  /** 1-based position within the active sequence. */
  position: number;
  total: number;
}

/**
 * Read access to a catalogue.
 *
 * Deliberately read-only and synchronous. Mutation belongs to whatever owns the
 * underlying store — the static adapter has nothing to mutate, and the
 * collection-backed one mutates through the existing item service. Widening
 * this interface to include writes would make every consumer a potential
 * writer, which is the coupling this exists to prevent.
 */
export interface ProblemCatalog {
  /** Every problem, in curriculum order. */
  list(): readonly CatalogProblem[];
  bySlug(slug: string): CatalogProblem | null;
  /** Resolves an old integer id. Returns null for entries that never had one. */
  byLegacyId(id: number): CatalogProblem | null;
  categories(): readonly string[];
  byCategory(category: string): readonly CatalogProblem[];
  /**
   * Adjacent problems in study order.
   *
   * Order comes from the catalogue's own `order` field rather than array
   * position, so a reordered or partially filtered list still navigates
   * correctly. Deliberately does not wrap: reaching either end disables the
   * button rather than silently looping, which would make position meaningless.
   */
  neighbours(slug: string, category?: string): CatalogNeighbours;
}

export const EMPTY_NEIGHBOURS: CatalogNeighbours = {
  previous: null,
  next: null,
  position: 0,
  total: 0,
};

/** Sorted by `order`, with slug as a stable tie-break. */
export function inCurriculumOrder(
  problems: readonly CatalogProblem[]
): readonly CatalogProblem[] {
  return [...problems].sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
}

/**
 * The shared implementation of every derived query.
 *
 * Both adapters hold an array of entries and differ only in where that array
 * comes from, so the query logic lives here once. A second adapter that
 * reimplemented `neighbours` would eventually disagree with the first about
 * what "next" means.
 */
export function catalogFrom(entries: readonly CatalogProblem[]): ProblemCatalog {
  const ordered = inCurriculumOrder(entries);
  const bySlug = new Map(ordered.map((problem) => [problem.slug, problem]));
  const byLegacy = new Map(
    ordered
      .filter((problem) => problem.legacyId !== undefined)
      .map((problem) => [problem.legacyId!, problem])
  );

  const categories = Array.from(new Set(ordered.map((problem) => problem.category)));

  return {
    list: () => ordered,
    bySlug: (slug) => bySlug.get(slug) ?? null,
    byLegacyId: (id) => byLegacy.get(id) ?? null,
    categories: () => categories,
    byCategory: (category) => ordered.filter((problem) => problem.category === category),

    neighbours(slug, category) {
      const sequence = category
        ? ordered.filter((problem) => problem.category === category)
        : ordered;
      const index = sequence.findIndex((problem) => problem.slug === slug);
      if (index === -1) return EMPTY_NEIGHBOURS;

      return {
        previous: index > 0 ? sequence[index - 1] : null,
        next: index < sequence.length - 1 ? sequence[index + 1] : null,
        position: index + 1,
        total: sequence.length,
      };
    },
  };
}

/** Slug from a LeetCode URL, or null. The one place this is derived. */
export function slugFromUrl(url: string): string | null {
  return url.match(/\/problems\/([^/?#]+)/)?.[1] ?? null;
}
