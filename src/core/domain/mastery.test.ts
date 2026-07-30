import { describe, expect, it } from "vitest";
import {
  isAttempted,
  isMasteryLevel,
  isSolved,
  MASTERY_CONFIG,
  MASTERY_LEVELS,
  toMasteryLevel,
} from "./mastery";

describe("levels", () => {
  it("are ordered weakest to strongest", () => {
    expect(MASTERY_LEVELS).toEqual(["unseen", "unsolved", "learning", "familiar", "mastered"]);
  });

  it("all have presentation config", () => {
    for (const level of MASTERY_LEVELS) {
      expect(MASTERY_CONFIG[level]?.label).toBeTruthy();
    }
  });
});

describe("isAttempted", () => {
  it("is false only for unseen", () => {
    expect(isAttempted("unseen")).toBe(false);
    expect(isAttempted("unsolved")).toBe(true);
    expect(isAttempted("learning")).toBe(true);
    expect(isAttempted("mastered")).toBe(true);
  });
});

describe("isSolved", () => {
  /**
   * The distinction that keeps the daily goal honest: an unsolved problem is
   * genuine practice (attempted) but was not solved, so it must not count
   * towards "problems solved today".
   */
  it("excludes both unseen and unsolved", () => {
    expect(isSolved("unseen")).toBe(false);
    expect(isSolved("unsolved")).toBe(false);
    expect(isSolved("learning")).toBe(true);
    expect(isSolved("familiar")).toBe(true);
    expect(isSolved("mastered")).toBe(true);
  });

  it("is stricter than isAttempted", () => {
    const attemptedNotSolved = MASTERY_LEVELS.filter((l) => isAttempted(l) && !isSolved(l));
    expect(attemptedNotSolved).toEqual(["unsolved"]);
  });
});

describe("narrowing", () => {
  it("accepts every known level", () => {
    for (const level of MASTERY_LEVELS) expect(isMasteryLevel(level)).toBe(true);
  });

  it("rejects unknown values", () => {
    expect(isMasteryLevel("solved")).toBe(false);
    expect(isMasteryLevel(null)).toBe(false);
    expect(isMasteryLevel(3)).toBe(false);
  });

  it("falls back to unseen for untrusted input", () => {
    expect(toMasteryLevel("garbage")).toBe("unseen");
    expect(toMasteryLevel(undefined)).toBe("unseen");
    expect(toMasteryLevel("unsolved")).toBe("unsolved");
  });
});
