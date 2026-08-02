import { describe, expect, it } from "vitest";
import {
  bandFor,
  flattenCriteria,
  maxScore,
  scoreRubric,
  suggestMastery,
  type RubricSection,
} from "./rubric";

const sections: RubricSection[] = [
  {
    title: "Requirements",
    criteria: [
      { id: "a", label: "Clarified functional requirements" },
      { id: "b", label: "Estimated QPS", weight: 2 },
    ],
  },
  {
    title: "Data",
    criteria: [
      { id: "c", label: "Chose a partition key", weight: 2 },
      { id: "d", label: "Named a datastore" },
    ],
  },
];

// Weights: a=1, b=2, c=2, d=1 → max 6
describe("maxScore", () => {
  it("sums weights, defaulting to 1", () => {
    expect(maxScore(sections)).toBe(6);
  });

  it("is zero for an empty rubric", () => {
    expect(maxScore([])).toBe(0);
  });
});

describe("flattenCriteria", () => {
  it("flattens across sections in order", () => {
    expect(flattenCriteria(sections).map((c) => c.id)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("scoreRubric", () => {
  it("scores nothing checked", () => {
    const result = scoreRubric(sections, []);
    expect(result).toMatchObject({ score: 0, max: 6, percent: 0, band: "needs-work" });
    expect(result.missedIds).toEqual(["a", "b", "c", "d"]);
  });

  it("scores everything checked", () => {
    const result = scoreRubric(sections, ["a", "b", "c", "d"]);
    expect(result).toMatchObject({ score: 6, max: 6, percent: 100, band: "strong" });
    expect(result.missedIds).toEqual([]);
  });

  it("respects weights", () => {
    // b alone is worth 2 of 6 → 33%
    expect(scoreRubric(sections, ["b"]).score).toBe(2);
    // a and d are worth 1 each → 2 of 6
    expect(scoreRubric(sections, ["a", "d"]).score).toBe(2);
  });

  it("reports exactly what was missed, so it doubles as a study list", () => {
    expect(scoreRubric(sections, ["a", "c"]).missedIds).toEqual(["b", "d"]);
  });

  it("ignores unknown ids rather than inflating the score", () => {
    expect(scoreRubric(sections, ["a", "does-not-exist"]).score).toBe(1);
  });

  it("handles an empty rubric without dividing by zero", () => {
    expect(scoreRubric([], [])).toMatchObject({ score: 0, max: 0, percent: 0 });
  });
});

describe("bandFor", () => {
  it.each([
    [0, "needs-work"],
    [39, "needs-work"],
    [40, "developing"],
    [64, "developing"],
    [65, "solid"],
    [84, "solid"],
    [85, "strong"],
    [100, "strong"],
  ] as const)("%i%% → %s", (percent, expected) => {
    expect(bandFor(percent)).toBe(expected);
  });
});

describe("suggestMastery", () => {
  /**
   * A design that scored below "developing" was attempted and did not hold up —
   * which is precisely what the `unsolved` level exists to record.
   */
  it("maps a weak attempt to unsolved, not unseen", () => {
    expect(suggestMastery(scoreRubric(sections, []))).toBe("unsolved");
  });

  it("maps a full score to mastered", () => {
    expect(suggestMastery(scoreRubric(sections, ["a", "b", "c", "d"]))).toBe("mastered");
  });

  it("never suggests unseen for an attempted exercise", () => {
    for (const checked of [[], ["a"], ["a", "b"], ["a", "b", "c"], ["a", "b", "c", "d"]]) {
      expect(suggestMastery(scoreRubric(sections, checked))).not.toBe("unseen");
    }
  });

  it("improves monotonically as more criteria are met", () => {
    const rank = { unseen: 0, unsolved: 1, learning: 2, familiar: 3, mastered: 4 };
    const progression = [[], ["a"], ["a", "b"], ["a", "b", "c"], ["a", "b", "c", "d"]].map(
      (checked) => rank[suggestMastery(scoreRubric(sections, checked))]
    );
    for (let i = 1; i < progression.length; i += 1) {
      expect(progression[i]).toBeGreaterThanOrEqual(progression[i - 1]);
    }
  });
});
