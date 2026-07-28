import { afterEach, describe, expect, it, vi } from "vitest";
import {
  collect,
  elapsedSeconds,
  IDLE_TIMER,
  isRunning,
  isTimerState,
  MIN_MEANINGFUL_SESSION_SECONDS,
  pause,
  reset,
  start,
  toggle,
} from "./timer";

const T0 = 1_700_000_000_000;

afterEach(() => {
  vi.useRealTimers();
});

describe("elapsedSeconds", () => {
  it("is zero for a fresh timer", () => {
    expect(elapsedSeconds(IDLE_TIMER, T0)).toBe(0);
  });

  it("derives live time from wall-clock rather than a tick counter", () => {
    const running = { accumulatedSeconds: 0, startedAt: T0 };
    expect(elapsedSeconds(running, T0 + 42_000)).toBe(42);
  });

  it("adds banked time to the current run", () => {
    const resumed = { accumulatedSeconds: 100, startedAt: T0 };
    expect(elapsedSeconds(resumed, T0 + 10_000)).toBe(110);
  });

  it("never goes negative if the clock jumps backwards", () => {
    const running = { accumulatedSeconds: 5, startedAt: T0 };
    expect(elapsedSeconds(running, T0 - 60_000)).toBe(5);
  });
});

describe("transitions", () => {
  it("start marks the timer running", () => {
    expect(isRunning(start(IDLE_TIMER, T0))).toBe(true);
  });

  it("start is idempotent and does not reset the origin", () => {
    const first = start(IDLE_TIMER, T0);
    expect(start(first, T0 + 5_000)).toBe(first);
  });

  it("pause banks elapsed time", () => {
    const paused = pause(start(IDLE_TIMER, T0), T0 + 30_000);
    expect(paused).toEqual({ accumulatedSeconds: 30, startedAt: null });
  });

  it("survives a pause/resume cycle without losing time", () => {
    let state = start(IDLE_TIMER, T0);
    state = pause(state, T0 + 30_000); // 30s
    state = start(state, T0 + 60_000); // resume 30s later
    expect(elapsedSeconds(state, T0 + 70_000)).toBe(40); // 30 banked + 10 live
  });

  it("reset clears everything", () => {
    expect(reset()).toEqual(IDLE_TIMER);
  });

  it("toggle flips between running and paused", () => {
    const running = toggle(IDLE_TIMER, T0);
    expect(isRunning(running)).toBe(true);
    expect(isRunning(toggle(running, T0 + 1_000))).toBe(false);
  });
});

describe("collect", () => {
  it("returns elapsed seconds and a cleared timer", () => {
    const result = collect(start(IDLE_TIMER, T0), T0 + 90_000);
    expect(result.seconds).toBe(90);
    expect(result.state).toEqual(IDLE_TIMER);
    expect(result.meaningful).toBe(true);
  });

  // Regression: submissions used to record 0:00 because the elapsed value was
  // read from stale React state. Sub-threshold sessions must be rejected.
  it("flags an instant submission as not meaningful", () => {
    const result = collect(start(IDLE_TIMER, T0), T0 + 500);
    expect(result.seconds).toBe(0);
    expect(result.meaningful).toBe(false);
  });

  it("treats exactly the threshold as meaningful", () => {
    const at = MIN_MEANINGFUL_SESSION_SECONDS * 1000;
    expect(collect(start(IDLE_TIMER, T0), T0 + at).meaningful).toBe(true);
  });

  it("rejects one second below the threshold", () => {
    const at = (MIN_MEANINGFUL_SESSION_SECONDS - 1) * 1000;
    expect(collect(start(IDLE_TIMER, T0), T0 + at).meaningful).toBe(false);
  });

  it("collects correctly while paused", () => {
    const paused = pause(start(IDLE_TIMER, T0), T0 + 20_000);
    expect(collect(paused, T0 + 999_999).seconds).toBe(20);
  });
});

describe("isTimerState", () => {
  it.each([
    ["valid running", { accumulatedSeconds: 10, startedAt: T0 }, true],
    ["valid paused", { accumulatedSeconds: 0, startedAt: null }, true],
    ["negative accumulation", { accumulatedSeconds: -1, startedAt: null }, false],
    ["wrong types", { accumulatedSeconds: "10", startedAt: null }, false],
    ["missing field", { startedAt: null }, false],
    ["null", null, false],
    ["string", "nope", false],
  ])("%s", (_label, input, expected) => {
    expect(isTimerState(input)).toBe(expected);
  });
});
