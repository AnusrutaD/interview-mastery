"use client";
import { useEffect, useRef } from "react";

/**
 * Re-runs `callback` whenever the user is likely to have stale data:
 * on tab focus, on window focus, and on a slow interval as a backstop.
 *
 * Focus is the important trigger: the usual flow is solve on LeetCode → switch
 * back to this tab, so refetching on visibility change makes the app feel live
 * without hammering the API. Polling only covers the case where the user leaves
 * the tab open and in front of them.
 */
export function useLiveSync(callback: () => void, options: { intervalMs?: number; enabled?: boolean } = {}) {
  const { intervalMs = 30_000, enabled = true } = options;

  // Keep the latest callback without re-registering listeners each render.
  const ref = useRef(callback);
  useEffect(() => {
    ref.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    const run = () => ref.current();
    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", run);
    const timer = window.setInterval(run, intervalMs);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", run);
      window.clearInterval(timer);
    };
  }, [enabled, intervalMs]);
}
