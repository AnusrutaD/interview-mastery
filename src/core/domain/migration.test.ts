import { describe, expect, it } from "vitest";
import {
  expectedMigratedCount,
  mapProblemToItem,
  mapProgressRow,
  partitionRows,
  slugForProblem,
  type CatalogueProblem,
  type LegacyProgressRow,
} from "./migration";
import { PROBLEMS } from "@/data/problems";

const problem: CatalogueProblem = {
  id: 3,
  title: "Two Sum",
  url: "https://leetcode.com/problems/two-sum/",
  difficulty: "Easy",
  category: "Arrays & Hashing",
  leetcode: "1",
};

function row(over: Partial<LegacyProgressRow> = {}): LegacyProgressRow {
  return {
    problemId: 3,
    mastery: "learning",
    notes: null,
    updatedAt: "2026-07-01T10:00:00.000Z",
    ...over,
  };
}

describe("slugForProblem", () => {
  it("extracts the LeetCode slug", () => {
    expect(slugForProblem(problem)).toBe("two-sum");
  });

  it("falls back to the id when the url has no slug", () => {
    expect(slugForProblem({ id: 42, url: "https://example.com" })).toBe("42");
  });

  it("produces a unique slug for every catalogue problem", () => {
    const slugs = PROBLEMS.map((p) => slugForProblem(p));
    expect(new Set(slugs).size).toBe(PROBLEMS.length);
  });
});

describe("mapProblemToItem", () => {
  it("carries reference data across", () => {
    expect(mapProblemToItem(problem)).toMatchObject({
      title: "Two Sum",
      kind: "problem",
      externalId: "two-sum",
      difficulty: "Easy",
      topic: "Arrays & Hashing",
    });
  });

  /**
   * Position preserves curriculum order, which is what the topic pages and
   * next/previous navigation rely on.
   */
  it("uses the catalogue id as the position", () => {
    expect(mapProblemToItem(problem).position).toBe(3);
  });

  /**
   * The legacy id has to survive so briefs (keyed on it) and any bookmarked
   * /problems/:id links can still resolve after the cutover.
   */
  it("retains the legacy problem id in metadata", () => {
    expect(mapProblemToItem(problem).metadata.legacyProblemId).toBe(3);
  });

  it("sets a dedupe key so a re-import cannot duplicate it", () => {
    expect(mapProblemToItem(problem).dedupeKey).toBe("two-sum");
  });
});

describe("mapProgressRow", () => {
  it("carries mastery, notes, counters and time", () => {
    const mapped = mapProgressRow(
      row({
        mastery: "familiar",
        notes: "hash map",
        companies: ["Amazon"],
        repeatCount: 3,
        totalTimeSeconds: 900,
      })
    );
    expect(mapped).toMatchObject({
      mastery: "familiar",
      notes: "hash map",
      companies: ["Amazon"],
      repeatCount: 3,
      totalTimeSeconds: 900,
    });
  });

  it("renames lastMasteryAt to lastPracticedAt", () => {
    const mapped = mapProgressRow(row({ lastMasteryAt: "2026-07-20T08:00:00.000Z" }));
    expect(mapped.lastPracticedAt).toBe("2026-07-20T08:00:00.000Z");
  });

  /**
   * Rows written before `lastMasteryAt` existed must keep their place in the
   * review schedule. Falling back to updatedAt matches what the current read
   * path already does — the alternative is silently resetting old history.
   */
  it("falls back to updatedAt when lastMasteryAt is absent", () => {
    const mapped = mapProgressRow(row({ lastMasteryAt: null }));
    expect(mapped.lastPracticedAt).toBe("2026-07-01T10:00:00.000Z");
  });

  it("never produces a null practice timestamp", () => {
    expect(mapProgressRow(row({ lastMasteryAt: undefined })).lastPracticedAt).toBeTruthy();
  });

  it("defaults missing counters to zero rather than null", () => {
    const mapped = mapProgressRow(row({ repeatCount: null, totalTimeSeconds: null }));
    expect(mapped).toMatchObject({ repeatCount: 0, totalTimeSeconds: 0, companies: [] });
  });

  it("narrows an unrecognised mastery value to unseen", () => {
    expect(mapProgressRow(row({ mastery: "solved" })).mastery).toBe("unseen");
  });

  it("preserves the unsolved level added after the original schema", () => {
    expect(mapProgressRow(row({ mastery: "unsolved" })).mastery).toBe("unsolved");
  });

  it("accepts Date objects as well as ISO strings", () => {
    const mapped = mapProgressRow(row({ lastMasteryAt: new Date("2026-07-20T08:00:00.000Z") }));
    expect(mapped.lastPracticedAt).toBe("2026-07-20T08:00:00.000Z");
  });
});

describe("partitionRows", () => {
  const known = new Set([1, 2, 3]);

  it("separates migratable rows from orphans", () => {
    const result = partitionRows([row({ problemId: 1 }), row({ problemId: 999 })], known);
    expect(result.migratable).toHaveLength(1);
    expect(result.orphaned).toHaveLength(1);
  });

  /**
   * Orphans come from the old extension bug that posted LeetCode numbers as
   * internal ids. They must be surfaced, not dropped silently — a migration
   * that quietly loses rows is worse than one that refuses them.
   */
  it("does not discard orphans", () => {
    const result = partitionRows([row({ problemId: 217 })], known);
    expect(result.orphaned[0].problemId).toBe(217);
  });

  it("handles an empty input", () => {
    expect(partitionRows([], known)).toEqual({ migratable: [], orphaned: [] });
  });

  it("loses nothing: every row lands in exactly one bucket", () => {
    const rows = [1, 2, 999, 3, 1000].map((problemId) => row({ problemId }));
    const { migratable, orphaned } = partitionRows(rows, known);
    expect(migratable.length + orphaned.length).toBe(rows.length);
  });
});

describe("expectedMigratedCount", () => {
  it("counts only migratable rows, so verification is not fooled by orphans", () => {
    const rows = [row({ problemId: 1 }), row({ problemId: 999 })];
    expect(expectedMigratedCount(rows, new Set([1]))).toBe(1);
  });
});

describe("full catalogue round trip", () => {
  it("maps every catalogue problem without collision", () => {
    const items = PROBLEMS.map(mapProblemToItem);
    expect(items).toHaveLength(150);
    expect(new Set(items.map((i) => i.dedupeKey)).size).toBe(150);
    expect(new Set(items.map((i) => i.position)).size).toBe(150);
  });

  it("gives every item a title and a url", () => {
    for (const item of PROBLEMS.map(mapProblemToItem)) {
      expect(item.title.length).toBeGreaterThan(0);
      expect(item.url).toMatch(/^https:\/\//);
    }
  });
});
