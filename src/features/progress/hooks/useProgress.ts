"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import type { MasteryLevel } from "@/core/domain/mastery";
import {
  EMPTY_PROGRESS,
  joinProgress,
  summarize,
  type ProblemWithProgress,
  type ProgressMap,
  type ProgressStats,
} from "@/core/domain/progress";
import { PROBLEMS, getProblemsByCategory } from "@/data/problems";
import {
  fetchProgress,
  saveProgress,
  reviseProblem as reviseProblemRequest,
  flagProblemForReview,
} from "../api/progress.client";
import { useLiveSync } from "./useLiveSync";

interface UseProgressOptions {
  /** Scope to one category so the request only fetches what's rendered. */
  category?: string;
  /** Poll interval; pass 0 to disable background refresh. */
  intervalMs?: number;
}

export interface UseProgressResult {
  problems: ProblemWithProgress[];
  stats: ProgressStats;
  loading: boolean;
  syncing: boolean;
  error: string | null;
  isAuthenticated: boolean;
  refresh: () => void;
  setMastery: (problemId: number, mastery: MasteryLevel) => Promise<void>;
  setNotes: (problemId: number, notes: string) => Promise<void>;
  /** Clear a due problem by reviewing it, without touching mastery. */
  revise: (problemId: number) => Promise<void>;
  /** Force a problem due, or clear that request. */
  setReviewFlag: (problemId: number, flagged: boolean) => Promise<void>;
}

/**
 * The single entry point for progress data in the UI.
 *
 * Owns fetching, live sync, optimistic updates and derived stats, so pages stay
 * declarative and every screen computes stats from the same domain helpers.
 */
export function useProgress(options: UseProgressOptions = {}): UseProgressResult {
  const { category, intervalMs = 30_000 } = options;
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";

  const [progress, setProgress] = useState<ProgressMap>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scopedProblems = useMemo(
    () => (category ? getProblemsByCategory(category) : PROBLEMS),
    [category]
  );

  const refresh = useCallback(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    setSyncing(true);
    fetchProgress({ category })
      .then((next) => {
        setProgress(next);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => {
        setSyncing(false);
        setLoading(false);
      });
  }, [isAuthenticated, category]);

  useEffect(() => {
    if (status === "loading") return;
    refresh();
  }, [status, refresh]);

  useLiveSync(refresh, { intervalMs, enabled: isAuthenticated && intervalMs > 0 });

  /** Optimistic write: update locally, persist, roll back on failure. */
  const mutate = useCallback(
    async (problemId: number, patch: { mastery?: MasteryLevel; notes?: string }) => {
      const previous = progress[problemId];

      setProgress((current) => ({
        ...current,
        [problemId]: {
          // Spread first so fields this action does not own — revision history,
          // review flags — survive, and a newly added field cannot be silently
          // dropped here the way it would be by rebuilding the record.
          ...(current[problemId] ?? EMPTY_PROGRESS),
          mastery: patch.mastery ?? current[problemId]?.mastery ?? "unseen",
          notes: patch.notes ?? current[problemId]?.notes ?? null,
          repeatCount:
            (current[problemId]?.repeatCount ?? 0) + (patch.mastery !== undefined ? 1 : 0),
          ...(patch.mastery !== undefined && {
            lastMasteryAt: new Date().toISOString(),
            // Solving answers a manual review request.
            flaggedForReviewAt: null,
          }),
          updatedAt: new Date().toISOString(),
        },
      }));

      if (!isAuthenticated) return;

      try {
        const saved = await saveProgress({ problemId, ...patch });
        setProgress((current) => ({ ...current, [problemId]: saved }));
      } catch (err) {
        setProgress((current) => {
          const rolledBack = { ...current };
          if (previous) rolledBack[problemId] = previous;
          else delete rolledBack[problemId];
          return rolledBack;
        });
        setError(err instanceof Error ? err.message : "Could not save");
        throw err;
      }
    },
    [progress, isAuthenticated]
  );

  const setMastery = useCallback(
    (problemId: number, mastery: MasteryLevel) => mutate(problemId, { mastery }),
    [mutate]
  );

  const setNotes = useCallback(
    (problemId: number, notes: string) => mutate(problemId, { notes }),
    [mutate]
  );

  const problems = useMemo(
    () => joinProgress(scopedProblems, progress),
    [scopedProblems, progress]
  );
  const stats = useMemo(() => summarize(problems), [problems]);

  const revise = useCallback(async (problemId: number) => {
    // Optimistic: clearing a due queue should feel immediate. The server owns
    // the counters, so the response replaces this guess rather than adding to it.
    setProgress((current) => ({
      ...current,
      [problemId]: {
        ...(current[problemId] ?? EMPTY_PROGRESS),
        revisionCount: (current[problemId]?.revisionCount ?? 0) + 1,
        lastRevisedAt: new Date().toISOString(),
        flaggedForReviewAt: null,
      },
    }));

    try {
      const saved = await reviseProblemRequest(problemId);
      setProgress((current) => ({ ...current, [problemId]: saved }));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record revision");
      refresh();
    }
  }, [refresh]);

  const setReviewFlag = useCallback(async (problemId: number, flagged: boolean) => {
    try {
      const saved = await flagProblemForReview(problemId, flagged);
      setProgress((current) => ({ ...current, [problemId]: saved }));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update review flag");
    }
  }, []);

  return {
    problems,
    stats,
    loading,
    syncing,
    error,
    isAuthenticated,
    refresh,
    setMastery,
    setNotes,
    revise,
    setReviewFlag,
  };
}
