import { describe, expect, it } from "vitest";
import { formatClock, formatDuration, pluralize } from "./format";

describe("formatClock", () => {
  it.each([
    [0, "00:00"],
    [5, "00:05"],
    [65, "01:05"],
    [599, "09:59"],
    [3600, "1:00:00"],
    [3725, "1:02:05"],
  ])("%is → %s", (seconds, expected) => {
    expect(formatClock(seconds)).toBe(expected);
  });

  it("clamps negatives rather than rendering a broken clock", () => {
    expect(formatClock(-10)).toBe("00:00");
  });

  it("truncates fractional seconds", () => {
    expect(formatClock(59.9)).toBe("00:59");
  });
});

describe("formatDuration", () => {
  it.each([
    [0, "0m"],
    [45, "45s"],
    [60, "1m"],
    [90, "1m"],
    [3599, "59m"],
    [3600, "1h"],
    [3660, "1h 1m"],
    [7325, "2h 2m"],
  ])("%is → %s", (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });

  it("omits the minutes part on an exact hour", () => {
    expect(formatDuration(7200)).toBe("2h");
  });
});

describe("pluralize", () => {
  it("uses the singular for one", () => {
    expect(pluralize(1, "time")).toBe("1 time");
  });

  it("uses the plural for zero and many", () => {
    expect(pluralize(0, "time")).toBe("0 times");
    expect(pluralize(5, "time")).toBe("5 times");
  });

  it("accepts an irregular plural", () => {
    expect(pluralize(2, "entry", "entries")).toBe("2 entries");
  });
});
