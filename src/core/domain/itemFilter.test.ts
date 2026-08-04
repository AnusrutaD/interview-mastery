import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { joinItems, type Item, type ItemProgressMap } from "./collection";
import { EMPTY_ITEM_RECORD } from "./collection";
import {
  ALL,
  applyItemFilters,
  DEFAULT_ITEM_FILTERS,
  deriveFacets,
  hasAnyFacet,
  isFiltering,
  reconcileFilters,
} from "./itemFilter";

const NOW = new Date("2026-07-28T04:30:00.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

function item(over: Partial<Item> & { id: string }): Item {
  return {
    collectionId: "c1",
    title: `Item ${over.id}`,
    url: null,
    kind: "problem",
    externalId: null,
    durationSeconds: null,
    difficulty: null,
    topic: null,
    tags: [],
    position: 0,
    metadata: null,
    ...over,
  };
}

const record = (over: Partial<typeof EMPTY_ITEM_RECORD> = {}) => ({
  ...EMPTY_ITEM_RECORD,
  ...over,
});

const join = (items: Item[], progress: ItemProgressMap = {}) => joinItems(items, progress);

describe("deriveFacets", () => {
  /**
   * The point of the whole module: a playlist has no difficulties, so it must
   * not be offered a difficulty filter with nothing useful in it.
   */
  it("offers no difficulty facet when items have none", () => {
    const facets = deriveFacets(join([item({ id: "a", kind: "video" }), item({ id: "b", kind: "video" })]));
    expect(facets.difficulties).toEqual([]);
  });

  it("offers difficulties when several are present, in conventional order", () => {
    const facets = deriveFacets(
      join([
        item({ id: "a", difficulty: "Hard" }),
        item({ id: "b", difficulty: "Easy" }),
        item({ id: "c", difficulty: "Medium" }),
      ])
    );
    expect(facets.difficulties).toEqual(["Easy", "Medium", "Hard"]);
  });

  /** A filter with one option cannot narrow anything — it is pure noise. */
  it("suppresses a facet that has only one distinct value", () => {
    const facets = deriveFacets(
      join([item({ id: "a", difficulty: "Easy" }), item({ id: "b", difficulty: "Easy" })])
    );
    expect(facets.difficulties).toEqual([]);
  });

  it("sorts unrecognised difficulties after the known ones", () => {
    const facets = deriveFacets(
      join([
        item({ id: "a", difficulty: "Insane" }),
        item({ id: "b", difficulty: "Easy" }),
        item({ id: "c", difficulty: "Beginner" }),
      ])
    );
    expect(facets.difficulties).toEqual(["Easy", "Beginner", "Insane"]);
  });

  it("offers a kind facet only for mixed lists", () => {
    expect(deriveFacets(join([item({ id: "a", kind: "video" }), item({ id: "b", kind: "video" })])).kinds).toEqual([]);
    expect(
      deriveFacets(join([item({ id: "a", kind: "video" }), item({ id: "b", kind: "problem" })])).kinds
    ).toHaveLength(2);
  });

  it("collects topics alphabetically and ignores blanks", () => {
    const facets = deriveFacets(
      join([
        item({ id: "a", topic: "Trees" }),
        item({ id: "b", topic: "Arrays" }),
        item({ id: "c", topic: "   " }),
      ])
    );
    expect(facets.topics).toEqual(["Arrays", "Trees"]);
  });

  it("reports due and unsolved presence", () => {
    const progress: ItemProgressMap = {
      a: record({ mastery: "learning", lastPracticedAt: "2026-07-01T10:00:00.000Z" }),
      b: record({ mastery: "unsolved", lastPracticedAt: NOW.toISOString() }),
    };
    const facets = deriveFacets(join([item({ id: "a" }), item({ id: "b" })], progress));
    expect(facets.hasDue).toBe(true);
    expect(facets.hasUnsolved).toBe(true);
  });

  it("does not offer search for a short list", () => {
    expect(deriveFacets(join([item({ id: "a" }), item({ id: "b" })])).worthSearching).toBe(false);
  });

  it("offers search once the list is long enough to need it", () => {
    const many = Array.from({ length: 20 }, (_, i) => item({ id: `i${i}` }));
    expect(deriveFacets(join(many)).worthSearching).toBe(true);
  });

  it("handles an empty list without throwing", () => {
    const facets = deriveFacets([]);
    expect(hasAnyFacet(facets)).toBe(false);
  });
});

describe("applyItemFilters", () => {
  /**
   * Built inside each test, not hoisted to a `const`.
   *
   * `joinItems` computes `due` from the current time, and a describe-level
   * fixture is evaluated during collection — before `beforeEach` installs the
   * fake timer. That version passed against the real clock for five days and
   * then started failing once the mastered review interval had genuinely
   * elapsed. A fixture that depends on wall-clock time is a time bomb, so the
   * frozen clock has to be in place before it is constructed.
   */
  const fixture = () =>
    join(
      [
        item({
          id: "a",
          title: "Two Sum",
          difficulty: "Easy",
          topic: "Arrays",
          externalId: "two-sum",
        }),
        item({ id: "b", title: "Merge Intervals", difficulty: "Medium", topic: "Intervals" }),
        item({ id: "c", title: "Caching deep dive", kind: "video", externalId: "abc123" }),
      ],
      {
        a: record({ mastery: "unsolved", lastPracticedAt: "2026-07-01T10:00:00.000Z" }),
        b: record({ mastery: "mastered", lastPracticedAt: NOW.toISOString() }),
      }
    );

  it("returns everything by default", () => {
    expect(applyItemFilters(fixture(), DEFAULT_ITEM_FILTERS)).toHaveLength(3);
  });

  it("filters by difficulty", () => {
    const result = applyItemFilters(fixture(), { ...DEFAULT_ITEM_FILTERS, difficulty: "Easy" });
    expect(result.map((i) => i.id)).toEqual(["a"]);
  });

  it("filters by kind", () => {
    const result = applyItemFilters(fixture(), { ...DEFAULT_ITEM_FILTERS, kind: "video" });
    expect(result.map((i) => i.id)).toEqual(["c"]);
  });

  it("filters by mastery", () => {
    const result = applyItemFilters(fixture(), { ...DEFAULT_ITEM_FILTERS, mastery: "mastered" });
    expect(result.map((i) => i.id)).toEqual(["b"]);
  });

  it("filters to due only", () => {
    const result = applyItemFilters(fixture(), { ...DEFAULT_ITEM_FILTERS, dueOnly: true });
    expect(result.map((i) => i.id)).toEqual(["a"]);
  });

  it("filters to unsolved only", () => {
    const result = applyItemFilters(fixture(), { ...DEFAULT_ITEM_FILTERS, unsolvedOnly: true });
    expect(result.map((i) => i.id)).toEqual(["a"]);
  });

  it("searches titles case-insensitively", () => {
    const result = applyItemFilters(fixture(), { ...DEFAULT_ITEM_FILTERS, search: "MERGE" });
    expect(result.map((i) => i.id)).toEqual(["b"]);
  });

  it("searches topics", () => {
    const result = applyItemFilters(fixture(), { ...DEFAULT_ITEM_FILTERS, search: "arrays" });
    expect(result.map((i) => i.id)).toEqual(["a"]);
  });

  /** Pasting a LeetCode slug or a YouTube id should find the item. */
  it("searches external ids", () => {
    expect(
      applyItemFilters(fixture(), { ...DEFAULT_ITEM_FILTERS, search: "abc123" }).map((i) => i.id)
    ).toEqual(["c"]);
  });

  it("ignores surrounding whitespace in the query", () => {
    expect(applyItemFilters(fixture(), { ...DEFAULT_ITEM_FILTERS, search: "  two  " })).toHaveLength(1);
  });

  it("combines filters conjunctively", () => {
    const result = applyItemFilters(fixture(), {
      ...DEFAULT_ITEM_FILTERS,
      difficulty: "Easy",
      mastery: "mastered",
    });
    expect(result).toHaveLength(0);
  });

  it("returns nothing when the query matches nothing", () => {
    expect(applyItemFilters(fixture(), { ...DEFAULT_ITEM_FILTERS, search: "zzzz" })).toHaveLength(0);
  });
});

describe("isFiltering", () => {
  it("is false for the defaults", () => {
    expect(isFiltering(DEFAULT_ITEM_FILTERS)).toBe(false);
  });

  it("ignores a whitespace-only query", () => {
    expect(isFiltering({ ...DEFAULT_ITEM_FILTERS, search: "   " })).toBe(false);
  });

  it.each([
    ["search", { search: "x" }],
    ["difficulty", { difficulty: "Easy" }],
    ["kind", { kind: "video" as const }],
    ["dueOnly", { dueOnly: true }],
    ["unsolvedOnly", { unsolvedOnly: true }],
  ])("is true when %s is set", (_label, patch) => {
    expect(isFiltering({ ...DEFAULT_ITEM_FILTERS, ...patch })).toBe(true);
  });
});

describe("reconcileFilters", () => {
  /**
   * Without this, deleting the last Hard item leaves the view filtered to
   * "Hard" and apparently empty, with no obvious way back.
   */
  it("clears a filter the items can no longer satisfy", () => {
    const facets = deriveFacets(
      join([item({ id: "a", difficulty: "Easy" }), item({ id: "b", difficulty: "Medium" })])
    );
    const reconciled = reconcileFilters(
      { ...DEFAULT_ITEM_FILTERS, difficulty: "Hard" },
      facets
    );
    expect(reconciled.difficulty).toBe(ALL);
  });

  it("keeps a filter that is still valid", () => {
    const facets = deriveFacets(
      join([item({ id: "a", difficulty: "Easy" }), item({ id: "b", difficulty: "Medium" })])
    );
    expect(reconcileFilters({ ...DEFAULT_ITEM_FILTERS, difficulty: "Easy" }, facets).difficulty).toBe(
      "Easy"
    );
  });

  it("clears dueOnly when nothing is due any more", () => {
    const facets = deriveFacets(join([item({ id: "a" })]));
    expect(reconcileFilters({ ...DEFAULT_ITEM_FILTERS, dueOnly: true }, facets).dueOnly).toBe(false);
  });

  it("leaves the search query alone — it is the user's own text", () => {
    const facets = deriveFacets(join([item({ id: "a" })]));
    expect(reconcileFilters({ ...DEFAULT_ITEM_FILTERS, search: "two" }, facets).search).toBe("two");
  });
});
