import { describe, expect, it } from "vitest";
import { PROBLEMS } from "./problems";
import { STATIC_CATALOG_ENTRIES, staticCatalog } from "./staticCatalog";

describe("the static adapter preserves the catalogue", () => {
  it("maps every problem", () => {
    expect(STATIC_CATALOG_ENTRIES).toHaveLength(PROBLEMS.length);
  });

  /**
   * The load-bearing invariant of the whole refactor: slug is identity, so two
   * problems sharing one would silently merge their briefs and progress.
   */
  it("gives every problem a distinct slug", () => {
    const slugs = STATIC_CATALOG_ENTRIES.map((entry) => entry.slug);
    expect(new Set(slugs).size).toBe(PROBLEMS.length);
  });

  it("agrees with the key the backfill wrote to Item.externalId", () => {
    for (const problem of PROBLEMS) {
      const expected = problem.url.match(/\/problems\/([^/]+)/)?.[1] ?? String(problem.id);
      expect(staticCatalog.byLegacyId(problem.id)?.slug).toBe(expected);
    }
  });

  it("keeps every legacy id resolvable, so old links and briefs still work", () => {
    for (const problem of PROBLEMS) {
      expect(staticCatalog.byLegacyId(problem.id)?.title).toBe(problem.title);
    }
  });

  it("preserves curriculum order", () => {
    expect(staticCatalog.list().map((entry) => entry.legacyId)).toEqual(
      PROBLEMS.map((problem) => problem.id)
    );
  });

  it("preserves the category set and their contents", () => {
    const fromSource = Array.from(new Set(PROBLEMS.map((p) => p.category)));
    expect(staticCatalog.categories()).toEqual(fromSource);

    for (const category of fromSource) {
      expect(staticCatalog.byCategory(category)).toHaveLength(
        PROBLEMS.filter((p) => p.category === category).length
      );
    }
  });

  /** Behaviour parity with the old getNeighbours, which walked array indices. */
  it("navigates identically to the old array-index walk", () => {
    PROBLEMS.forEach((problem, index) => {
      const slug = staticCatalog.byLegacyId(problem.id)!.slug;
      const at = staticCatalog.neighbours(slug);
      expect(at.previous?.legacyId ?? null).toBe(index > 0 ? PROBLEMS[index - 1].id : null);
      expect(at.next?.legacyId ?? null).toBe(
        index < PROBLEMS.length - 1 ? PROBLEMS[index + 1].id : null
      );
      expect(at.position).toBe(index + 1);
      expect(at.total).toBe(PROBLEMS.length);
    });
  });
});
