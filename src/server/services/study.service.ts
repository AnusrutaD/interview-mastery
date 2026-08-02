import "server-only";
import type { StudyProgress } from "@prisma/client";
import { toMasteryLevel, type MasteryLevel } from "@/core/domain/mastery";
import type { StudyItemType } from "@/core/domain/systemDesign";
import { prisma } from "../db/prisma";
import type { UpsertStudyProgressInput } from "../validation/study.schema";

const SELECT = {
  itemType: true,
  itemSlug: true,
  mastery: true,
  notes: true,
  quizBestScore: true,
  quizTotal: true,
  quizAttempts: true,
  rubricChecked: true,
  rubricScore: true,
  rubricMax: true,
  repeatCount: true,
  totalTimeSeconds: true,
  lastMasteryAt: true,
  updatedAt: true,
} satisfies Record<string, true>;

type Row = Pick<StudyProgress, keyof typeof SELECT>;

export interface StudyRecord {
  itemType: StudyItemType;
  itemSlug: string;
  mastery: MasteryLevel;
  notes: string | null;
  quizBestScore: number | null;
  quizTotal: number | null;
  quizAttempts: number;
  rubricChecked: string[];
  rubricScore: number | null;
  rubricMax: number | null;
  repeatCount: number;
  totalTimeSeconds: number;
  lastMasteryAt: string | null;
  updatedAt: string | null;
}

/** Keyed by slug — item types never share a slug across concepts/exercises. */
export type StudyProgressMap = Record<string, StudyRecord>;

export const EMPTY_STUDY_RECORD: Omit<StudyRecord, "itemType" | "itemSlug"> = {
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

function toRecord(row: Row): StudyRecord {
  return {
    itemType: row.itemType as StudyItemType,
    itemSlug: row.itemSlug,
    mastery: toMasteryLevel(row.mastery),
    notes: row.notes,
    quizBestScore: row.quizBestScore,
    quizTotal: row.quizTotal,
    quizAttempts: row.quizAttempts ?? 0,
    rubricChecked: row.rubricChecked ?? [],
    rubricScore: row.rubricScore,
    rubricMax: row.rubricMax,
    repeatCount: row.repeatCount ?? 0,
    totalTimeSeconds: row.totalTimeSeconds ?? 0,
    lastMasteryAt: row.lastMasteryAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

export async function listStudyProgress(userId: string): Promise<StudyProgressMap> {
  const rows = await prisma.studyProgress.findMany({ where: { userId }, select: SELECT });
  const map: StudyProgressMap = {};
  for (const row of rows) map[row.itemSlug] = toRecord(row);
  return map;
}

export async function getStudyProgress(
  userId: string,
  itemType: StudyItemType,
  itemSlug: string
): Promise<StudyRecord | null> {
  const row = await prisma.studyProgress.findUnique({
    where: { userId_itemType_itemSlug: { userId, itemType, itemSlug } },
    select: SELECT,
  });
  return row ? toRecord(row) : null;
}

/**
 * Upsert study progress.
 *
 * Mirrors `upsertProgress` semantics deliberately, so the two tracks behave
 * identically for scheduling and timing:
 *   - `mastery` present → deliberate practice: bump repeatCount, stamp
 *     lastMasteryAt (which drives spaced repetition).
 *   - `notes` / `timeSeconds` alone → must not count as practice.
 *
 * Quiz scores are kept as a personal best rather than last-attempt. Retaking a
 * quiz to reinforce a concept should never be punished by a worse number, and
 * a best score is the honest answer to "do I know this?".
 */
export async function upsertStudyProgress(
  userId: string,
  input: UpsertStudyProgressInput
): Promise<StudyRecord> {
  const { itemType, itemSlug } = input;
  const isPractice = input.mastery !== undefined;
  const now = new Date();
  const seconds = input.timeSeconds ?? 0;

  const existing = await prisma.studyProgress.findUnique({
    where: { userId_itemType_itemSlug: { userId, itemType, itemSlug } },
    select: { quizBestScore: true },
  });

  const quizUpdate = input.quiz
    ? {
        quizBestScore: Math.max(input.quiz.score, existing?.quizBestScore ?? 0),
        quizTotal: input.quiz.total,
        quizAttempts: { increment: 1 },
      }
    : {};

  const rubricUpdate = input.rubric
    ? {
        rubricChecked: input.rubric.checked,
        rubricScore: input.rubric.score,
        rubricMax: input.rubric.max,
      }
    : {};

  const row = await prisma.studyProgress.upsert({
    where: { userId_itemType_itemSlug: { userId, itemType, itemSlug } },
    update: {
      ...(isPractice && {
        mastery: input.mastery,
        repeatCount: { increment: 1 },
        lastMasteryAt: now,
      }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(seconds > 0 && { totalTimeSeconds: { increment: seconds } }),
      ...quizUpdate,
      ...rubricUpdate,
    },
    create: {
      userId,
      itemType,
      itemSlug,
      mastery: input.mastery ?? "unseen",
      notes: input.notes ?? null,
      repeatCount: isPractice ? 1 : 0,
      totalTimeSeconds: seconds,
      lastMasteryAt: isPractice ? now : null,
      ...(input.quiz && {
        quizBestScore: input.quiz.score,
        quizTotal: input.quiz.total,
        quizAttempts: 1,
      }),
      ...(input.rubric && {
        rubricChecked: input.rubric.checked,
        rubricScore: input.rubric.score,
        rubricMax: input.rubric.max,
      }),
    },
    select: SELECT,
  });

  return toRecord(row);
}
