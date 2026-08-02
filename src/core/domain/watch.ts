/**
 * Watch-progress tracking for video items.
 *
 * The central problem: a naive `furthest = max(furthest, position)` lets anyone
 * drag the scrubber to the end and be marked complete. That makes the whole
 * feature worthless as a record of what you actually watched.
 *
 * So progress is accumulated from *plausible playback deltas* instead. Each
 * tick contributes only if the position advanced by an amount consistent with
 * real playback since the previous sample. A jump larger than that is a seek:
 * the resume position updates, but no watch credit is given.
 *
 * Pure and framework-free, so the rule is unit-tested rather than only
 * observable by sitting through a video.
 */

export interface WatchState {
  /** Accumulated seconds of genuine playback. Drives completion. */
  watchedSeconds: number;
  /** Where to resume from. Follows seeks immediately. */
  positionSeconds: number;
}

export const EMPTY_WATCH: WatchState = { watchedSeconds: 0, positionSeconds: 0 };

/**
 * Fraction of a video that counts as finished.
 *
 * Not 100%: most videos end with an outro, credits or an end-card that nobody
 * watches, and requiring the final second would leave items permanently stuck
 * at "almost done".
 */
export const COMPLETION_THRESHOLD = 0.9;

/**
 * Largest forward jump still treated as playback rather than a seek.
 *
 * Sized generously against the sampling interval so a slow tick, a dropped
 * frame or 2× playback speed is not misread as scrubbing.
 */
export const MAX_PLAYBACK_DELTA_SECONDS = 12;

export interface TickInput {
  /** Player position at the previous sample. */
  previousPosition: number;
  /** Player position now. */
  currentPosition: number;
  /** Override for tests or unusual sampling rates. */
  maxDelta?: number;
}

/**
 * Fold one sample into the watch state.
 *
 * Returns a new state; never mutates. Rewinding updates the resume position but
 * costs no credit — re-watching a section should not double count either, which
 * falls out naturally because only forward motion contributes.
 */
export function recordTick(state: WatchState, input: TickInput): WatchState {
  const { previousPosition, currentPosition } = input;
  const maxDelta = input.maxDelta ?? MAX_PLAYBACK_DELTA_SECONDS;

  const delta = currentPosition - previousPosition;
  const isPlayback = delta > 0 && delta <= maxDelta;

  return {
    // A seek still moves the resume point — the user really is there now.
    positionSeconds: Math.max(0, currentPosition),
    watchedSeconds: isPlayback ? state.watchedSeconds + delta : state.watchedSeconds,
  };
}

export interface WatchProgress {
  watchedSeconds: number;
  positionSeconds: number;
  durationSeconds: number | null;
  /** 0–100. Zero when the duration is unknown. */
  percent: number;
  complete: boolean;
  /** Seconds of genuine viewing still required to reach the threshold. */
  remainingSeconds: number;
}

export function describeWatch(
  state: WatchState,
  durationSeconds: number | null
): WatchProgress {
  if (!durationSeconds || durationSeconds <= 0) {
    return {
      ...state,
      durationSeconds: null,
      percent: 0,
      complete: false,
      remainingSeconds: 0,
    };
  }

  // Cap at the duration: accumulated time can exceed it when a section is
  // re-watched, and a 130% progress bar reads as a bug.
  const effective = Math.min(state.watchedSeconds, durationSeconds);
  const required = durationSeconds * COMPLETION_THRESHOLD;

  return {
    watchedSeconds: state.watchedSeconds,
    positionSeconds: state.positionSeconds,
    durationSeconds,
    percent: Math.round((effective / durationSeconds) * 100),
    complete: effective >= required,
    remainingSeconds: Math.max(0, Math.ceil(required - effective)),
  };
}

/** Whether this sample crosses the completion threshold for the first time. */
export function justCompleted(
  before: WatchState,
  after: WatchState,
  durationSeconds: number | null
): boolean {
  if (!durationSeconds) return false;
  return (
    !describeWatch(before, durationSeconds).complete &&
    describeWatch(after, durationSeconds).complete
  );
}

/* ── ISO 8601 durations ───────────────────────────────────────────────────── */

const ISO_DURATION = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;

/**
 * Parse the ISO 8601 duration the YouTube Data API returns (`PT4M13S`).
 *
 * Returns null rather than throwing or guessing — a video whose duration cannot
 * be read simply has no duration, and the UI already handles that by hiding the
 * progress bar instead of showing a wrong one.
 */
export function parseIsoDuration(value: string | null | undefined): number | null {
  if (!value || typeof value !== "string") return null;

  const match = value.trim().match(ISO_DURATION);
  if (!match) return null;

  const [, days, hours, minutes, seconds] = match;
  if (!days && !hours && !minutes && !seconds) return null;

  const total =
    Number(days ?? 0) * 86_400 +
    Number(hours ?? 0) * 3_600 +
    Number(minutes ?? 0) * 60 +
    Math.floor(Number(seconds ?? 0));

  return Number.isFinite(total) && total > 0 ? total : null;
}
