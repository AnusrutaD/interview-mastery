"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import type { MasteryLevel } from "@/core/domain/mastery";
import { EMPTY_PROGRESS, type ProgressRecord } from "@/core/domain/progress";
import { isDue, reviewLabel } from "@/core/domain/review";
import { useSolveTimer } from "@/features/timer/hooks/useSolveTimer";
import {
  fetchProblemProgress,
  saveMastery,
  saveNotes,
  saveTimeOnly,
} from "../api/progress.client";
import { useLiveSync } from "./useLiveSync";

/** How a completed attempt reached us. */
export type SubmissionSource = "app" | "leetcode";

export interface LastSession {
  source: SubmissionSource;
  /** null when the attempt happened outside our measuring window. */
  seconds: number | null;
}

export interface UseProblemSessionResult {
  record: ProgressRecord;
  loading: boolean;
  saving: boolean;
  error: string | null;
  isAuthenticated: boolean;
  due: boolean;
  reviewStatus: string | null;
  lastSession: LastSession | null;
  timer: ReturnType<typeof useSolveTimer>;
  setMastery: (level: MasteryLevel) => Promise<void>;
  setNotes: (notes: string) => Promise<void>;
  dismissLastSession: () => void;
}

/**
 * Everything the problem detail page needs, with both submission paths unified.
 *
 * A problem can be completed two ways:
 *   1. In-app  — the user picks a mastery level here.
 *   2. LeetCode — the Chrome extension posts to the API from another tab.
 *
 * Path 2 is invisible to this page unless we look for it, which is why the
 * timer used to keep running and the elapsed time was never saved. We detect it
 * by watching `lastMasteryAt` for a value newer than the one we already knew.
 *
 * Two guards keep that detection honest:
 *   - `mountedAt` — only claim to have timed a submission that landed after we
 *     started counting, otherwise an earlier sync would be credited 0:00.
 *   - `meaningful` (from the timer domain) — sessions under the minimum are
 *     neither stored nor displayed.
 */
export function useProblemSession(problemId: number | null): UseProblemSessionResult {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";

  const [record, setRecord] = useState<ProgressRecord>(EMPTY_PROGRESS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSession, setLastSession] = useState<LastSession | null>(null);

  const timer = useSolveTimer(problemId);
  const { start: startTimer, collect: collectTimer } = timer;

  const knownMasteryAt = useRef<string | null>(null);
  const hydrated = useRef(false);
  const mountedAt = useRef(Date.now());

  // Reset per-problem bookkeeping when navigating between problems.
  useEffect(() => {
    hydrated.current = false;
    knownMasteryAt.current = null;
    mountedAt.current = Date.now();
    setLastSession(null);
    setLoading(true);
  }, [problemId]);

  useEffect(() => {
    if (isAuthenticated && problemId !== null) startTimer();
  }, [isAuthenticated, problemId, startTimer]);

  const sync = useCallback(async () => {
    if (!isAuthenticated || problemId === null) {
      setLoading(false);
      return;
    }

    try {
      const next = await fetchProblemProgress(problemId);
      const serverMasteryAt = next.lastMasteryAt;

      // First response is hydration, never a submission signal.
      if (!hydrated.current) {
        hydrated.current = true;
        knownMasteryAt.current = serverMasteryAt;
        setRecord(next);
        setError(null);
        setLoading(false);
        return;
      }

      const isNewer =
        serverMasteryAt !== null &&
        (knownMasteryAt.current === null ||
          new Date(serverMasteryAt) > new Date(knownMasteryAt.current));

      if (isNewer) {
        knownMasteryAt.current = serverMasteryAt;
        const timedByUs = new Date(serverMasteryAt).getTime() >= mountedAt.current;
        const session = collectTimer();
        const credit = timedByUs && session.meaningful;

        setLastSession({ source: "leetcode", seconds: credit ? session.seconds : null });

        if (credit) {
          const saved = await saveTimeOnly(problemId, session.seconds);
          setRecord(saved);
          setError(null);
          return;
        }
      }

      setRecord(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, problemId, collectTimer]);

  useEffect(() => {
    if (status === "loading") return;
    void sync();
  }, [status, sync]);

  // 10s here rather than the 30s used elsewhere: this is the screen the user
  // watches while solving, so it should feel immediate.
  useLiveSync(() => void sync(), { intervalMs: 10_000, enabled: isAuthenticated });

  const setMastery = useCallback(
    async (level: MasteryLevel) => {
      if (problemId === null) return;
      const session = collectTimer();
      setLastSession({ source: "app", seconds: session.meaningful ? session.seconds : null });
      setSaving(true);
      try {
        const saved = await saveMastery(
          problemId,
          level,
          session.meaningful ? session.seconds : undefined
        );
        setRecord(saved);
        // Record our own write so the poller doesn't read it back as external.
        knownMasteryAt.current = saved.lastMasteryAt;
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save");
      } finally {
        setSaving(false);
      }
    },
    [problemId, collectTimer]
  );

  const setNotes = useCallback(
    async (notes: string) => {
      if (problemId === null || notes === (record.notes ?? "")) return;
      setSaving(true);
      try {
        const saved = await saveNotes(problemId, notes);
        setRecord(saved);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save notes");
      } finally {
        setSaving(false);
      }
    },
    [problemId, record.notes]
  );

  return {
    record,
    loading,
    saving,
    error,
    isAuthenticated,
    // Scheduling reads lastMasteryAt, never updatedAt — see core/domain/review.
    due: isDue(record.mastery, record.lastMasteryAt),
    reviewStatus: reviewLabel(record.mastery, record.lastMasteryAt),
    lastSession,
    timer,
    setMastery,
    setNotes,
    dismissLastSession: useCallback(() => setLastSession(null), []),
  };
}
