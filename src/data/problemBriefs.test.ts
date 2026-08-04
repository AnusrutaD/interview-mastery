import { describe, expect, it } from "vitest";
import BRIEFS, { BRIEF_SLUGS, getProblemBrief, hasProblemBrief } from "./problemBriefs";
import { staticCatalog } from "./staticCatalog";

const CATALOGUE = staticCatalog.list();

describe("coverage", () => {
  it("has a brief for every problem in the catalogue", () => {
    const missing = CATALOGUE.filter((p) => !hasProblemBrief(p.slug)).map(
      (p) => `${p.slug} ${p.title}`
    );
    expect(missing).toEqual([]);
  });

  it("has no briefs for problems that do not exist", () => {
    const known = new Set(CATALOGUE.map((p) => p.slug));
    expect(BRIEF_SLUGS.filter((slug) => !known.has(slug))).toEqual([]);
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

  /**
   * These four fields are what make a brief self-contained. If any is missing,
   * revising the problem sends you back to LeetCode — which is the whole thing
   * this data exists to avoid.
   */
  it("every brief is self-contained: signature, worked example and constraints", () => {
    for (const [id, brief] of entries) {
      expect(brief.signature, `problem ${id} signature`).toMatch(/\(|:/);
      expect(brief.example.input.length, `problem ${id} example input`).toBeGreaterThan(3);
      expect(brief.example.output.length, `problem ${id} example output`).toBeGreaterThan(0);
      expect(brief.example.why.length, `problem ${id} example rationale`).toBeGreaterThan(15);
      expect(brief.constraints.length, `problem ${id} constraints`).toBeGreaterThanOrEqual(2);
    }
  });

  it("constraints are phrased as statements, not empty filler", () => {
    for (const [id, brief] of entries) {
      for (const constraint of brief.constraints) {
        expect(constraint.trim().length, `problem ${id} constraint`).toBeGreaterThan(5);
      }
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
    for (const problem of CATALOGUE) {
      const brief = getProblemBrief(problem.slug)!;
      expect(brief.task.toLowerCase().trim()).not.toBe(problem.title.toLowerCase().trim());
    }
  });
});

describe("lookup", () => {
  it("returns null for an unknown slug", () => {
    expect(getProblemBrief("not-a-real-problem")).toBeNull();
  });

  it("returns the brief for a known slug", () => {
    expect(getProblemBrief("two-sum")?.task).toContain("two indices");
  });

  /**
   * The point of rekeying: a brief is now reachable by the name of the problem,
   * not by its place in a list that may be reordered.
   */
  it("is unaffected by curriculum order", () => {
    expect(getProblemBrief("trapping-rain-water")).not.toBeNull();
  });
});
