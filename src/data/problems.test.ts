import { describe, expect, it } from "vitest";
import {
  CATEGORIES,
  categoryToSlug,
  getNeighbours,
  getProblemById,
  getProblemBySlug,
  getProblemsByCategory,
  PROBLEMS,
  slugToCategory,
} from "./problems";

describe("catalogue integrity", () => {
  it("contains the full NeetCode 150", () => {
    expect(PROBLEMS).toHaveLength(150);
  });

  it("has unique, contiguous ids", () => {
    const ids = PROBLEMS.map((p) => p.id);
    expect(new Set(ids).size).toBe(150);
    expect(Math.min(...ids)).toBe(1);
    expect(Math.max(...ids)).toBe(150);
  });

  it("groups each category contiguously so sequential study works", () => {
    const seen = new Set<string>();
    let current = "";
    for (const problem of PROBLEMS) {
      if (problem.category !== current) {
        // Revisiting a category means its problems are split across the list,
        // which would make next/previous jump around within a topic.
        expect(seen.has(problem.category)).toBe(false);
        seen.add(problem.category);
        current = problem.category;
      }
    }
  });
});

describe("lookups", () => {
  it("finds a problem by id", () => {
    expect(getProblemById(1)?.title).toBe("Contains Duplicate");
  });

  it("returns null for an unknown id", () => {
    expect(getProblemById(9999)).toBeNull();
    expect(getProblemById(0)).toBeNull();
  });

  it("finds a problem by LeetCode slug", () => {
    expect(getProblemBySlug("two-sum")?.id).toBe(3);
  });

  it("returns null for an unknown slug", () => {
    expect(getProblemBySlug("not-a-real-problem")).toBeNull();
  });

  it("round-trips every category through its slug", () => {
    for (const category of CATEGORIES) {
      expect(slugToCategory(categoryToSlug(category))).toBe(category);
    }
  });

  it("produces url-safe slugs", () => {
    expect(categoryToSlug("Heap / Priority Queue")).toBe("heap-priority-queue");
    expect(categoryToSlug("1D Dynamic Programming")).toBe("1d-dynamic-programming");
  });
});

describe("getNeighbours — global sequence", () => {
  it("has no previous at the very start", () => {
    const { previous, next, position, total } = getNeighbours(1);
    expect(previous).toBeNull();
    expect(next?.id).toBe(2);
    expect(position).toBe(1);
    expect(total).toBe(150);
  });

  it("has no next at the very end", () => {
    const { previous, next, position } = getNeighbours(150);
    expect(previous?.id).toBe(149);
    expect(next).toBeNull();
    expect(position).toBe(150);
  });

  it("links both directions in the middle", () => {
    const { previous, next } = getNeighbours(75);
    expect(previous?.id).toBe(74);
    expect(next?.id).toBe(76);
  });

  it("does not wrap around", () => {
    expect(getNeighbours(1).previous).toBeNull();
    expect(getNeighbours(150).next).toBeNull();
  });

  it("returns an empty result for an unknown problem", () => {
    expect(getNeighbours(9999)).toEqual({
      previous: null,
      next: null,
      position: 0,
      total: 0,
    });
  });
});

describe("getNeighbours — category scope", () => {
  const category = "Two Pointers";
  const inCategory = getProblemsByCategory(category);

  it("stops at the category boundary instead of leaking into the next topic", () => {
    const first = inCategory[0];
    const last = inCategory[inCategory.length - 1];

    expect(getNeighbours(first.id, category).previous).toBeNull();
    expect(getNeighbours(last.id, category).next).toBeNull();

    // Unscoped, the same problems do have neighbours — proving scope matters.
    expect(getNeighbours(first.id).previous).not.toBeNull();
    expect(getNeighbours(last.id).next).not.toBeNull();
  });

  it("reports position within the category, not the whole list", () => {
    const second = inCategory[1];
    expect(getNeighbours(second.id, category)).toMatchObject({
      position: 2,
      total: inCategory.length,
    });
  });

  it("keeps every step inside the category", () => {
    for (const problem of inCategory) {
      const { previous, next } = getNeighbours(problem.id, category);
      expect(previous?.category ?? category).toBe(category);
      expect(next?.category ?? category).toBe(category);
    }
  });

  it("can walk a whole category end to end", () => {
    let cursor = inCategory[0];
    const visited = [cursor.id];
    let hop = getNeighbours(cursor.id, category).next;
    while (hop) {
      visited.push(hop.id);
      cursor = hop;
      hop = getNeighbours(cursor.id, category).next;
    }
    expect(visited).toEqual(inCategory.map((p) => p.id));
  });
});
