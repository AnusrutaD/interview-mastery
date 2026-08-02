"use client";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import type { MasteryLevel } from "@/core/domain/mastery";
import { gradeQuiz, type QuizAnswers, type QuizQuestion, type QuizResult } from "@/core/domain/quiz";
import { isDue, reviewLabel } from "@/core/domain/review";
import { scoreRubric, suggestMastery, type RubricSection } from "@/core/domain/rubric";
import type { StudyItemType } from "@/core/domain/systemDesign";
import { useSolveTimer } from "@/features/timer/hooks/useSolveTimer";
import type { StudyRecord } from "@/server/services/study.service";
import { fetchStudyProgress, saveStudyProgress } from "../api/study.client";

const EMPTY: Omit<StudyRecord, "itemType" | "itemSlug"> = {
  mastery: "unseen",
  notes: null,
  quizBestScore: null,
  quizTotal: null,
  quizAttempts: 0,
  rubricChecked: [],
  rubricScore: null,
  rubricMax: null,
  repeatCount: 0,
  totalTimeSeconds: 0,
  lastMasteryAt: null,
  updatedAt: null,
};

/**
 * Study-item session state.
 *
 * The solve timer is keyed by a hash of the slug so it can reuse
 * `useSolveTimer` unchanged — that hook stores state per numeric id, and study
 * items are slug-keyed. A stable non-cryptographic hash is fine here: a
 * collision would only mean two items sharing a localStorage timer key.
 */
function slugKey(slug: string): number {
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) {
    hash = (hash * 31 + slug.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export interface UseStudyItemResult {
  record: Omit<StudyRecord, "itemType" | "itemSlug">;
  loading: boolean;
  saving: boolean;
  error: string | null;
  isAuthenticated: boolean;
  due: boolean;
  reviewStatus: string | null;
  timer: ReturnType<typeof useSolveTimer>;
  /** True once the exercise has been attempted — gates the reference solution. */
  hasAttempted: boolean;
  setMastery: (level: MasteryLevel) => Promise<void>;
  setNotes: (notes: string) => Promise<void>;
  submitQuiz: (questions: readonly QuizQuestion[], answers: QuizAnswers) => Promise<QuizResult>;
  submitRubric: (sections: readonly RubricSection[], checked: string[]) => Promise<void>;
}

export function useStudyItem(itemType: StudyItemType, slug: string): UseStudyItemResult {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";

  const [record, setRecord] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timer = useSolveTimer(slugKey(slug));
  const { start: startTimer, collect: collectTimer } = timer;

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetchStudyProgress()
      .then((map) => {
        if (cancelled) return;
        setRecord(map[slug] ?? EMPTY);
        setError(null);
      })
      .catch((err: Error) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, slug]);

  // Exercises are timed like a real interview; concepts are not a race.
  useEffect(() => {
    if (isAuthenticated && itemType === "exercise") startTimer();
  }, [isAuthenticated, itemType, startTimer]);

  const persist = useCallback(
    async (payload: Parameters<typeof saveStudyProgress>[0]) => {
      if (!isAuthenticated) return;
      setSaving(true);
      try {
        const saved = await saveStudyProgress(payload);
        setRecord(saved);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save");
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [isAuthenticated]
  );

  const setMastery = useCallback(
    async (mastery: MasteryLevel) => {
      const session = collectTimer();
      await persist({
        itemType,
        itemSlug: slug,
        mastery,
        ...(session.meaningful ? { timeSeconds: session.seconds } : {}),
      });
    },
    [itemType, slug, persist, collectTimer]
  );

  const setNotes = useCallback(
    (notes: string) => persist({ itemType, itemSlug: slug, notes }),
    [itemType, slug, persist]
  );

  const submitQuiz = useCallback(
    async (questions: readonly QuizQuestion[], answers: QuizAnswers) => {
      const result = gradeQuiz(questions, answers);
      await persist({
        itemType,
        itemSlug: slug,
        quiz: { score: result.correct, total: result.total },
        // Passing the quiz is evidence the concept landed, but only nudge
        // upward — never downgrade a level the user has already earned.
        ...(result.passed && record.mastery === "unseen" ? { mastery: "learning" as const } : {}),
      }).catch(() => undefined);
      return result;
    },
    [itemType, slug, persist, record.mastery]
  );

  const submitRubric = useCallback(
    async (sections: readonly RubricSection[], checked: string[]) => {
      const result = scoreRubric(sections, checked);
      const session = collectTimer();
      await persist({
        itemType,
        itemSlug: slug,
        rubric: { checked, score: result.score, max: result.max },
        mastery: suggestMastery(result),
        ...(session.meaningful ? { timeSeconds: session.seconds } : {}),
      });
    },
    [itemType, slug, persist, collectTimer]
  );

  return {
    record,
    loading,
    saving,
    error,
    isAuthenticated,
    due: isDue(record.mastery, record.lastMasteryAt),
    reviewStatus: reviewLabel(record.mastery, record.lastMasteryAt),
    timer,
    hasAttempted: record.rubricScore !== null || record.mastery !== "unseen",
    setMastery,
    setNotes,
    submitQuiz,
    submitRubric,
  };
}
