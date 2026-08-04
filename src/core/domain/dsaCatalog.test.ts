import { describe, expect, it } from "vitest";
import { PROBLEMS } from "../../data/problems";
import { buildProblemIdBySlug, buildSlugByProblemId, slugForProblem } from "./dsaCatalog";

describe("slugForProblem", () => {
  it("extracts the LeetCode slug", () => {
    expect(slugForProblem({ id: 1, url: "https://leetcode.com/problems/two-sum/" })).toBe("two-sum");
  });

  it("ignores anything after the slug", () => {
    expect(
      slugForProblem({ id: 1, url: "https://leetcode.com/problems/two-sum/description/?x=1" })
    ).toBe("two-sum");
  });

  /**
   * Falling back to the id rather than a constant matters: a shared fallback
   * would map every malformed row onto the same item and silently merge
   * unrelated progress.
   */
  it("falls back to a unique key when the url has no slug", () => {
    expect(slugForProblem({ id: 42, url: "not-a-leetcode-url" })).toBe("42");
    expect(slugForProblem({ id: 43, url: "" })).toBe("43");
  });
});

describe("catalogue indexes", () => {
  it("round-trips every problem id through its slug", () => {
    const slugById = buildSlugByProblemId(PROBLEMS);
    const idBySlug = buildProblemIdBySlug(PROBLEMS);

    for (const problem of PROBLEMS) {
      expect(idBySlug.get(slugById.get(problem.id)!)).toBe(problem.id);
    }
  });

  /**
   * A duplicate slug would make two problems share one item, so progress on one
   * would overwrite the other. Cheap to assert, expensive to discover later.
   */
  it("assigns every catalogue problem a distinct slug", () => {
    const slugs = PROBLEMS.map((p) => slugForProblem(p));
    expect(new Set(slugs).size).toBe(PROBLEMS.length);
  });

  it("indexes the whole catalogue", () => {
    expect(buildProblemIdBySlug(PROBLEMS).size).toBe(PROBLEMS.length);
    expect(buildSlugByProblemId(PROBLEMS).size).toBe(PROBLEMS.length);
  });
});
