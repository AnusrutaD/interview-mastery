"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  collect,
  elapsedSeconds,
  IDLE_TIMER,
  isRunning,
  isTimerState,
  pause,
  reset,
  start,
  type CollectedSession,
  type TimerState,
} from "@/core/domain/timer";

const storageKey = (problemId: number) => `im:timer:${problemId}`;

function load(problemId: number): TimerState {
  if (typeof window === "undefined") return IDLE_TIMER;
  try {
    const raw = window.localStorage.getItem(storageKey(problemId));
    if (!raw) return IDLE_TIMER;
    const parsed: unknown = JSON.parse(raw);
    return isTimerState(parsed) ? parsed : IDLE_TIMER;
  } catch {
    return IDLE_TIMER;
  }
}

function persist(problemId: number, state: TimerState) {
  if (typeof window === "undefined") return;
  try {
    if (state === IDLE_TIMER || (state.accumulatedSeconds === 0 && state.startedAt === null)) {
      window.localStorage.removeItem(storageKey(problemId));
    } else {
      window.localStorage.setItem(storageKey(problemId), JSON.stringify(state));
    }
  } catch {
    /* storage unavailable (private mode / quota) — timer still works in memory */
  }
}

export interface UseSolveTimerResult {
  running: boolean;
  /** Seconds to render. Recomputed from wall-clock, so it cannot drift. */
  elapsed: number;
  start: () => void;
  pause: () => void;
  toggle: () => void;
  reset: () => void;
  /** Stop, clear, and return the session for persisting. */
  collect: () => CollectedSession;
}

/**
 * Solve timer bound to one problem.
 *
 * All arithmetic is delegated to the pure `core/domain/timer` module and the
 * authoritative state is held in a ref, so callbacks never close over a stale
 * elapsed value — the defect that made submissions record 0 seconds.
 *
 * State is mirrored to localStorage so reloading, or navigating away and back,
 * resumes the same session rather than silently restarting it.
 */
export function useSolveTimer(problemId: number | null): UseSolveTimerResult {
  const stateRef = useRef<TimerState>(IDLE_TIMER);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const commit = useCallback(
    (next: TimerState) => {
      stateRef.current = next;
      setRunning(isRunning(next));
      setElapsed(elapsedSeconds(next));
      if (problemId !== null) persist(problemId, next);
    },
    [problemId]
  );

  // Rehydrate whenever the problem changes.
  useEffect(() => {
    if (problemId === null) return;
    const restored = load(problemId);
    stateRef.current = restored;
    setRunning(isRunning(restored));
    setElapsed(elapsedSeconds(restored));
  }, [problemId]);

  // Tick only while running. The displayed value is derived from wall-clock,
  // so a throttled background tab self-corrects on the next tick.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setElapsed(elapsedSeconds(stateRef.current)), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  // Recompute immediately on return to the tab, ahead of the next tick.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") setElapsed(elapsedSeconds(stateRef.current));
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  // Flush before unload so a reload resumes seamlessly.
  useEffect(() => {
    if (problemId === null) return;
    const save = () => persist(problemId, stateRef.current);
    window.addEventListener("beforeunload", save);
    window.addEventListener("pagehide", save);
    return () => {
      window.removeEventListener("beforeunload", save);
      window.removeEventListener("pagehide", save);
    };
  }, [problemId]);

  return {
    running,
    elapsed,
    start: useCallback(() => commit(start(stateRef.current)), [commit]),
    pause: useCallback(() => commit(pause(stateRef.current)), [commit]),
    toggle: useCallback(
      () => commit(isRunning(stateRef.current) ? pause(stateRef.current) : start(stateRef.current)),
      [commit]
    ),
    reset: useCallback(() => commit(reset()), [commit]),
    collect: useCallback(() => {
      const result = collect(stateRef.current);
      commit(result.state);
      return result;
    }, [commit]),
  };
}
