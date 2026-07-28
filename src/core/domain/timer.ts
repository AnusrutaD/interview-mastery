/**
 * Pure solve-timer arithmetic, deliberately free of React.
 *
 * The original timer stored elapsed seconds in React state and read it inside
 * callbacks, so every handler captured a stale value and submissions recorded
 * 0 seconds. Modelling the timer as an immutable value with explicit
 * transitions removes that whole class of bug and makes it unit-testable.
 *
 * A timer is either paused (`startedAt === null`) or running. Elapsed time is
 * always derived from wall-clock, never accumulated by a ticking counter, so
 * background-tab throttling cannot cause drift.
 */

export interface TimerState {
  /** Seconds banked from previous runs. */
  accumulatedSeconds: number;
  /** Epoch ms the current run began, or null when paused. */
  startedAt: number | null;
}

export const IDLE_TIMER: TimerState = { accumulatedSeconds: 0, startedAt: null };

/**
 * Sessions shorter than this are treated as noise — an accidental click, an
 * extension echo, or a page opened and submitted instantly. They are neither
 * persisted nor displayed, because a recorded "0:00 solve" is worse than no
 * data at all.
 */
export const MIN_MEANINGFUL_SESSION_SECONDS = 5;

export function isRunning(state: TimerState): boolean {
  return state.startedAt !== null;
}

/** Total elapsed seconds at instant `now`. */
export function elapsedSeconds(state: TimerState, now: number = Date.now()): number {
  const live = state.startedAt === null ? 0 : Math.floor((now - state.startedAt) / 1000);
  return state.accumulatedSeconds + Math.max(0, live);
}

export function start(state: TimerState, now: number = Date.now()): TimerState {
  return isRunning(state) ? state : { ...state, startedAt: now };
}

export function pause(state: TimerState, now: number = Date.now()): TimerState {
  if (!isRunning(state)) return state;
  return { accumulatedSeconds: elapsedSeconds(state, now), startedAt: null };
}

export function reset(): TimerState {
  return IDLE_TIMER;
}

export function toggle(state: TimerState, now: number = Date.now()): TimerState {
  return isRunning(state) ? pause(state, now) : start(state, now);
}

export interface CollectedSession {
  /** Timer reset and ready for the next attempt. */
  state: TimerState;
  seconds: number;
  /** Whether the session is long enough to persist and display. */
  meaningful: boolean;
}

/**
 * Stop the timer and harvest the session. Always returns a fresh idle state so
 * the next attempt starts clean, and flags whether the result is worth keeping.
 */
export function collect(state: TimerState, now: number = Date.now()): CollectedSession {
  const seconds = elapsedSeconds(state, now);
  return {
    state: IDLE_TIMER,
    seconds,
    meaningful: seconds >= MIN_MEANINGFUL_SESSION_SECONDS,
  };
}

/** Guard for rehydrating persisted state from untrusted storage. */
export function isTimerState(value: unknown): value is TimerState {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  const accOk =
    typeof candidate.accumulatedSeconds === "number" &&
    Number.isFinite(candidate.accumulatedSeconds) &&
    candidate.accumulatedSeconds >= 0;
  const startOk =
    candidate.startedAt === null ||
    (typeof candidate.startedAt === "number" && Number.isFinite(candidate.startedAt));
  return accOk && startOk;
}
