"use client";
import { useState, useRef, useEffect, useCallback } from "react";

/**
 * Per-problem solve timer that survives reloads and tab switches.
 *
 * State lives in refs (source of truth) + localStorage (durability).
 * React state is only a render mirror, so callers never read stale values.
 *
 * Time is written to the DB exactly once — at submission — so there is no
 * risk of double counting. Abandoning a problem without submitting simply
 * discards the session, which is the correct semantics for "time to solve".
 */
const storageKey = (problemId) => `im-timer-${problemId}`;

export function useProblemTimer(problemId) {
  const [running, setRunning] = useState(false);
  const [display, setDisplay] = useState(0);

  const accRef   = useRef(0);     // seconds banked from previous runs
  const startRef = useRef(null);  // epoch ms of the current run (null = paused)
  const tickRef  = useRef(null);  // interval id

  /** Current elapsed seconds — always accurate, never stale. */
  const read = useCallback(
    () => accRef.current + (startRef.current ? Math.floor((Date.now() - startRef.current) / 1000) : 0),
    []
  );

  const persist = useCallback(() => {
    if (typeof window === "undefined" || problemId == null) return;
    try {
      localStorage.setItem(
        storageKey(problemId),
        JSON.stringify({ acc: accRef.current, start: startRef.current })
      );
    } catch {}
  }, [problemId]);

  const clearPersisted = useCallback(() => {
    if (typeof window === "undefined" || problemId == null) return;
    try { localStorage.removeItem(storageKey(problemId)); } catch {}
  }, [problemId]);

  const stopTick = () => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
  };

  const startTick = useCallback(() => {
    stopTick();
    tickRef.current = setInterval(() => setDisplay(read()), 1000);
  }, [read]);

  const start = useCallback(() => {
    if (startRef.current) return;          // already running
    startRef.current = Date.now();
    setRunning(true);
    setDisplay(read());
    startTick();
    persist();
  }, [read, startTick, persist]);

  const pause = useCallback(() => {
    if (!startRef.current) return;
    stopTick();
    accRef.current = read();
    startRef.current = null;
    setDisplay(accRef.current);
    setRunning(false);
    persist();
  }, [read, persist]);

  const reset = useCallback(() => {
    stopTick();
    accRef.current = 0;
    startRef.current = null;
    setDisplay(0);
    setRunning(false);
    clearPersisted();
  }, [clearPersisted]);

  /**
   * Stop the clock, return the seconds for this session, and wipe state so the
   * next attempt starts clean. Used by BOTH submission paths.
   */
  const stopAndCollect = useCallback(() => {
    const seconds = read();
    stopTick();
    accRef.current = 0;
    startRef.current = null;
    setDisplay(0);
    setRunning(false);
    clearPersisted();
    return seconds;
  }, [read, clearPersisted]);

  // ── Rehydrate from localStorage on mount, then auto-start ────────────────
  useEffect(() => {
    if (problemId == null) return;
    try {
      const raw = localStorage.getItem(storageKey(problemId));
      if (raw) {
        const { acc, start: savedStart } = JSON.parse(raw);
        accRef.current = typeof acc === "number" ? acc : 0;
        // If it was running when we left, keep counting from the original start
        startRef.current = typeof savedStart === "number" ? savedStart : null;
      }
    } catch {}

    if (startRef.current) {
      setRunning(true);
      setDisplay(read());
      startTick();
    } else {
      setDisplay(accRef.current);
    }

    return () => stopTick();
  }, [problemId, read, startTick]);

  // Keep the display honest when returning to a backgrounded tab
  // (browsers throttle setInterval in background tabs).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && startRef.current) {
        setDisplay(read());
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [read]);

  // Persist before the tab goes away so a reload resumes seamlessly
  useEffect(() => {
    const save = () => persist();
    window.addEventListener("beforeunload", save);
    window.addEventListener("pagehide", save);
    return () => {
      window.removeEventListener("beforeunload", save);
      window.removeEventListener("pagehide", save);
    };
  }, [persist]);

  return { running, display, read, start, pause, reset, stopAndCollect };
}
