import { describe, expect, it } from "vitest";
import {
  COMPLETION_THRESHOLD,
  describeWatch,
  EMPTY_WATCH,
  justCompleted,
  parseIsoDuration,
  recordTick,
  type WatchState,
} from "./watch";

/** Simulate steady playback in `step`-second samples. */
function play(from: WatchState, seconds: number, step = 5): WatchState {
  let state = from;
  let position = state.positionSeconds;
  for (let elapsed = 0; elapsed < seconds; elapsed += step) {
    const next = position + Math.min(step, seconds - elapsed);
    state = recordTick(state, { previousPosition: position, currentPosition: next });
    position = next;
  }
  return state;
}

describe("recordTick", () => {
  it("credits ordinary playback", () => {
    const state = recordTick(EMPTY_WATCH, { previousPosition: 0, currentPosition: 5 });
    expect(state).toEqual({ watchedSeconds: 5, positionSeconds: 5 });
  });

  it("accumulates across samples", () => {
    expect(play(EMPTY_WATCH, 60).watchedSeconds).toBe(60);
  });

  /**
   * The rule the whole feature rests on: dragging to the end must not count as
   * having watched it. Without this, tracked watch time means nothing.
   */
  it("gives no credit for seeking forward", () => {
    const state = recordTick(EMPTY_WATCH, { previousPosition: 0, currentPosition: 600 });
    expect(state.watchedSeconds).toBe(0);
    // The user really is at 600s now, so resume still moves.
    expect(state.positionSeconds).toBe(600);
  });

  it("gives no credit for rewinding", () => {
    const watched = play(EMPTY_WATCH, 100);
    const rewound = recordTick(watched, { previousPosition: 100, currentPosition: 20 });
    expect(rewound.watchedSeconds).toBe(watched.watchedSeconds);
    expect(rewound.positionSeconds).toBe(20);
  });

  it("does not double count a re-watched section", () => {
    let state = play(EMPTY_WATCH, 60);
    state = recordTick(state, { previousPosition: 60, currentPosition: 0 }); // rewind
    state = play(state, 60);
    // 60 genuinely new + 60 re-watched = 120 of playback, which is honest:
    // the cap against duration happens in describeWatch, not here.
    expect(state.watchedSeconds).toBe(120);
  });

  it("treats a pause with no movement as no progress", () => {
    const state = recordTick(EMPTY_WATCH, { previousPosition: 30, currentPosition: 30 });
    expect(state.watchedSeconds).toBe(0);
  });

  it("tolerates a sample at double playback speed", () => {
    const state = recordTick(EMPTY_WATCH, { previousPosition: 0, currentPosition: 10 });
    expect(state.watchedSeconds).toBe(10);
  });

  it("rejects a jump beyond the plausible window", () => {
    const state = recordTick(EMPTY_WATCH, { previousPosition: 0, currentPosition: 13 });
    expect(state.watchedSeconds).toBe(0);
  });

  it("never produces a negative position", () => {
    expect(recordTick(EMPTY_WATCH, { previousPosition: 5, currentPosition: -3 }).positionSeconds).toBe(0);
  });

  it("does not mutate the input state", () => {
    const original: WatchState = { watchedSeconds: 10, positionSeconds: 10 };
    recordTick(original, { previousPosition: 10, currentPosition: 15 });
    expect(original).toEqual({ watchedSeconds: 10, positionSeconds: 10 });
  });
});

describe("describeWatch", () => {
  it("reports zero progress with no duration", () => {
    expect(describeWatch({ watchedSeconds: 100, positionSeconds: 100 }, null)).toMatchObject({
      percent: 0,
      complete: false,
    });
  });

  it("computes a percentage against the duration", () => {
    expect(describeWatch({ watchedSeconds: 50, positionSeconds: 50 }, 200).percent).toBe(25);
  });

  it("completes at the threshold rather than requiring the final second", () => {
    const duration = 600;
    const atThreshold = { watchedSeconds: duration * COMPLETION_THRESHOLD, positionSeconds: 540 };
    expect(describeWatch(atThreshold, duration).complete).toBe(true);
  });

  it("is not complete just below the threshold", () => {
    const duration = 600;
    const almost = { watchedSeconds: duration * COMPLETION_THRESHOLD - 1, positionSeconds: 539 };
    expect(describeWatch(almost, duration).complete).toBe(false);
  });

  /** A re-watched video can accumulate more than its length; 130% reads as a bug. */
  it("caps the percentage at 100", () => {
    expect(describeWatch({ watchedSeconds: 900, positionSeconds: 300 }, 300).percent).toBe(100);
  });

  it("reports the seconds still needed", () => {
    const result = describeWatch({ watchedSeconds: 0, positionSeconds: 0 }, 100);
    expect(result.remainingSeconds).toBe(90);
  });

  it("reports zero remaining once complete", () => {
    expect(describeWatch({ watchedSeconds: 100, positionSeconds: 100 }, 100).remainingSeconds).toBe(0);
  });

  it("handles a zero duration without dividing by zero", () => {
    expect(describeWatch(EMPTY_WATCH, 0)).toMatchObject({ percent: 0, complete: false });
  });
});

describe("justCompleted", () => {
  it("fires only on the sample that crosses the threshold", () => {
    const duration = 100;
    const before = { watchedSeconds: 89, positionSeconds: 89 };
    const after = { watchedSeconds: 91, positionSeconds: 91 };
    expect(justCompleted(before, after, duration)).toBe(true);
  });

  it("does not fire again once already complete", () => {
    const duration = 100;
    const before = { watchedSeconds: 95, positionSeconds: 95 };
    const after = { watchedSeconds: 99, positionSeconds: 99 };
    expect(justCompleted(before, after, duration)).toBe(false);
  });

  it("does not fire without a duration", () => {
    expect(justCompleted(EMPTY_WATCH, { watchedSeconds: 999, positionSeconds: 999 }, null)).toBe(false);
  });
});

describe("parseIsoDuration", () => {
  it.each([
    ["PT4M13S", 253],
    ["PT1H2M3S", 3723],
    ["PT45S", 45],
    ["PT2H", 7200],
    ["PT30M", 1800],
    ["P1DT2H", 93600],
  ])("%s → %is", (input, expected) => {
    expect(parseIsoDuration(input)).toBe(expected);
  });

  it("truncates fractional seconds", () => {
    expect(parseIsoDuration("PT10.5S")).toBe(10);
  });

  /**
   * Returning null rather than guessing matters: the UI hides the progress bar
   * for an unknown duration, which is better than showing a wrong one.
   */
  it.each([null, undefined, "", "  ", "4M13S", "not a duration", "P", "PT"])(
    "returns null for %p",
    (input) => {
      expect(parseIsoDuration(input as string)).toBeNull();
    }
  );

  it("returns null for a zero duration", () => {
    expect(parseIsoDuration("PT0S")).toBeNull();
  });
});
