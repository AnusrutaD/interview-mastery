"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import type { MasteryLevel } from "@/core/domain/mastery";
import { EMPTY_PROGRESS, type ProgressRecord } from "@/core/domain/progress";
import { isDueNow, isFlaggedForReview, reviewAnchor, reviewLabel } from "@/core/domain/review";
import { useSolveTimer } from "@/features/timer/hooks/useSolveTimer";
import {
  fetchProblemProgress,
  flagProblemForReview,
  reviseProblem,
  saveCompanies,
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
  setCompanies: (companies: string[]) => Promise<void>;
  /** Clear a due problem by reviewing it, without touching mastery. */
  revise: () => Promise<void>;
  /** Force this problem due, or clear that request. */
  setReviewFlag: (flagged: boolean) => Promise<void>;
  /** Due because the user asked, not because the schedule said so. */
  flagged: boolean;
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

  const setCompanies = useCallback(
    async (companies: string[]) => {
      if (problemId === null) return;
      // Optimistic: chip add/remove should feel instant.
      setRecord((current) => ({ ...current, companies }));
      setSaving(true);
      try {
        setRecord(await saveCompanies(problemId, companies));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save companies");
      } finally {
        setSaving(false);
      }
    },
    [problemId]
  );

  const revise = useCallback(async () => {
    if (problemId === null) return;
    setSaving(true);
    try {
      const saved = await reviseProblem(problemId);
      setRecord(saved);
      // A revision does not change lastMasteryAt, so the external-submission
      // detector must not be told otherwise — leaving `knownMasteryAt` alone is
      // what stops a revision from masking a real LeetCode submission.
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record revision");
    } finally {
      setSaving(false);
    }
  }, [problemId]);

  const setReviewFlag = useCallback(
    async (flagged: boolean) => {
      if (problemId === null) return;
      setSaving(true);
      try {
        setRecord(await flagProblemForReview(problemId, flagged));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update review flag");
      } finally {
        setSaving(false);
      }
    },
    [problemId]
  );

  // Scheduling reads the review anchor — the later of practice and revision —
  // never updatedAt. See core/domain/review.ts.
  const reviewState = {
    mastery: record.mastery,
    lastPracticedAt: record.lastMasteryAt,
    lastRevisedAt: record.lastRevisedAt,
    flaggedForReviewAt: record.flaggedForReviewAt,
  };

  return {
    record,
    loading,
    saving,
    error,
    isAuthenticated,
    due: isDueNow(reviewState),
    flagged: isFlaggedForReview(reviewState),
    reviewStatus: reviewLabel(record.mastery, reviewAnchor(reviewState)),
    lastSession,
    timer,
    setMastery,
    setNotes,
    setCompanies,
    revise,
    setReviewFlag,
    dismissLastSession: useCallback(() => setLastSession(null), []),
  };
}
