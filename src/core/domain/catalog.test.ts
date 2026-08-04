import { describe, expect, it } from "vitest";
import { catalogFrom, inCurriculumOrder, slugFromUrl, type CatalogProblem } from "./catalog";

const problem = (over: Partial<CatalogProblem> & { slug: string }): CatalogProblem => ({
  title: over.slug,
  difficulty: "Easy",
  category: "Arrays",
  leetcode: "1",
  url: `https://leetcode.com/problems/${over.slug}/`,
  order: 0,
  ...over,
});

const sample = [
  problem({ slug: "a", order: 0, category: "Arrays", legacyId: 1 }),
  problem({ slug: "b", order: 1, category: "Arrays", legacyId: 2 }),
  problem({ slug: "c", order: 2, category: "Trees", legacyId: 3 }),
  problem({ slug: "d", order: 3, category: "Trees" }),
];

describe("inCurriculumOrder", () => {
  it("sorts by order, not by input position", () => {
    const shuffled = [problem({ slug: "z", order: 5 }), problem({ slug: "a", order: 1 })];
    expect(inCurriculumOrder(shuffled).map((p) => p.slug)).toEqual(["a", "z"]);
  });

  /** Duplicate orders are possible after a partial reorder; output must be stable. */
  it("breaks ties on slug so the sequence never flickers", () => {
    const tied = [
      problem({ slug: "c", order: 0 }),
      problem({ slug: "a", order: 0 }),
      problem({ slug: "b", order: 0 }),
    ];
    expect(inCurriculumOrder(tied).map((p) => p.slug)).toEqual(["a", "b", "c"]);
  });
});

describe("catalogFrom", () => {
  const catalog = catalogFrom(sample);

  it("looks up by slug", () => {
    expect(catalog.bySlug("b")?.title).toBe("b");
    expect(catalog.bySlug("nope")).toBeNull();
  });

  it("resolves legacy integer ids for old links and briefs", () => {
    expect(catalog.byLegacyId(2)?.slug).toBe("b");
  });

  /**
   * A user-added problem has no legacy id. That is a normal state, not an
   * error — the lookup simply misses.
   */
  it("returns null for an entry that never had a legacy id", () => {
    expect(catalog.byLegacyId(999)).toBeNull();
    expect(catalog.list().find((p) => p.slug === "d")?.legacyId).toBeUndefined();
  });

  it("lists categories in first-seen order", () => {
    expect(catalog.categories()).toEqual(["Arrays", "Trees"]);
  });

  it("filters by category", () => {
    expect(catalog.byCategory("Trees").map((p) => p.slug)).toEqual(["c", "d"]);
  });
});

describe("neighbours", () => {
  const catalog = catalogFrom(sample);

  it("walks the full sequence by default", () => {
    const at = catalog.neighbours("b");
    expect(at.previous?.slug).toBe("a");
    expect(at.next?.slug).toBe("c");
    expect(at.position).toBe(2);
    expect(at.total).toBe(4);
  });

  /** A user working through Trees should not be thrown into another topic. */
  it("stays inside a category when one is given", () => {
    const at = catalog.neighbours("c", "Trees");
    expect(at.previous).toBeNull();
    expect(at.next?.slug).toBe("d");
    expect(at.total).toBe(2);
  });

  it("does not wrap at either end", () => {
    expect(catalog.neighbours("a").previous).toBeNull();
    expect(catalog.neighbours("d").next).toBeNull();
  });

  it("returns the empty result for an unknown slug", () => {
    expect(catalog.neighbours("nope")).toMatchObject({ position: 0, total: 0 });
  });

  /**
   * The reason `order` exists as its own field: rewriting it must change
   * navigation, and must not require touching identity, briefs or URLs.
   */
  it("follows order rather than array position", () => {
    const reordered = catalogFrom([
      problem({ slug: "a", order: 10 }),
      problem({ slug: "b", order: 0 }),
    ]);
    expect(reordered.neighbours("b").next?.slug).toBe("a");
    expect(reordered.list().map((p) => p.slug)).toEqual(["b", "a"]);
  });

  it("navigates a catalogue that gained an item in the middle", () => {
    const withInsert = catalogFrom([...sample, problem({ slug: "new", order: 1.5 })]);
    expect(withInsert.neighbours("new").previous?.slug).toBe("b");
    expect(withInsert.neighbours("new").next?.slug).toBe("c");
  });
});

describe("slugFromUrl", () => {
  it("extracts the slug", () => {
    expect(slugFromUrl("https://leetcode.com/problems/two-sum/")).toBe("two-sum");
  });

  it("ignores query strings and fragments", () => {
    expect(slugFromUrl("https://leetcode.com/problems/two-sum/?tab=x#y")).toBe("two-sum");
  });

  it("returns null when there is no slug", () => {
    expect(slugFromUrl("https://example.com/")).toBeNull();
    expect(slugFromUrl("")).toBeNull();
  });
});
