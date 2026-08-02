import { describe, expect, it } from "vitest";
import BRIEFS, { BRIEF_IDS, getProblemBrief, hasProblemBrief } from "./problemBriefs";
import { PROBLEMS } from "./problems";

describe("coverage", () => {
  it("has a brief for every problem in the catalogue", () => {
    const missing = PROBLEMS.filter((p) => !hasProblemBrief(p.id)).map((p) => `${p.id} ${p.title}`);
    expect(missing).toEqual([]);
  });

  it("has no briefs for problems that do not exist", () => {
    const known = new Set(PROBLEMS.map((p) => p.id));
    expect(BRIEF_IDS.filter((id) => !known.has(id))).toEqual([]);
  });
});

describe("content quality", () => {
  const entries = Object.entries(BRIEFS);

  it("every brief has a non-trivial task, insight and complexity", () => {
    for (const [id, brief] of entries) {
      expect(brief.task.length, `problem ${id} task`).toBeGreaterThan(20);
      expect(brief.insight.length, `problem ${id} insight`).toBeGreaterThan(20);
      expect(brief.complexity.length, `problem ${id} complexity`).toBeGreaterThan(3);
    }
  });

  it("states a complexity bound in a recognisable form", () => {
    for (const [id, brief] of entries) {
      expect(brief.complexity, `problem ${id}`).toMatch(/O\(|fixed size|Exponential/i);
    }
  });

  // Terminal punctuation, not specifically a full stop — several tasks are
  // naturally phrased as questions ("Can all courses be finished?").
  const TERMINATED = /[.?…]$/;

  it("ends sentences properly, so the UI never renders a truncated fragment", () => {
    for (const [id, brief] of entries) {
      expect(brief.task, `problem ${id} task`).toMatch(TERMINATED);
      expect(brief.insight, `problem ${id} insight`).toMatch(TERMINATED);
      if (brief.pitfall) {
        expect(brief.pitfall, `problem ${id} pitfall`).toMatch(TERMINATED);
      }
    }
  });

  /**
   * These briefs are original content. A brief that merely echoes the problem
   * title is a placeholder, not a restatement — catch those.
   */
  it("does not simply restate the problem title", () => {
    for (const problem of PROBLEMS) {
      const brief = getProblemBrief(problem.id)!;
      expect(brief.task.toLowerCase().trim()).not.toBe(problem.title.toLowerCase().trim());
    }
  });
});

describe("lookup", () => {
  it("returns null for an unknown id", () => {
    expect(getProblemBrief(9999)).toBeNull();
  });

  it("returns the brief for a known id", () => {
    expect(getProblemBrief(3)?.task).toContain("two indices");
  });
});
