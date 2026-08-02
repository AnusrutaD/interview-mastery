"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import type { MasteryLevel } from "@/core/domain/mastery";
import {
  joinProgress,
  summarize,
  type ProblemWithProgress,
  type ProgressMap,
  type ProgressStats,
} from "@/core/domain/progress";
import { PROBLEMS, getProblemsByCategory } from "@/data/problems";
import { fetchProgress, saveProgress } from "../api/progress.client";
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
          mastery: patch.mastery ?? current[problemId]?.mastery ?? "unseen",
          notes: patch.notes ?? current[problemId]?.notes ?? null,
          companies: current[problemId]?.companies ?? [],
          repeatCount:
            (current[problemId]?.repeatCount ?? 0) + (patch.mastery !== undefined ? 1 : 0),
          totalTimeSeconds: current[problemId]?.totalTimeSeconds ?? 0,
          lastMasteryAt:
            patch.mastery !== undefined
              ? new Date().toISOString()
              : (current[problemId]?.lastMasteryAt ?? null),
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
  };
}
