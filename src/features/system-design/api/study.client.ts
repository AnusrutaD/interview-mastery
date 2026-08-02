import type { MasteryLevel } from "@/core/domain/mastery";
import type { StudyItemType } from "@/core/domain/systemDesign";
import type { StudyProgressMap, StudyRecord } from "@/server/services/study.service";
import { get, post } from "@/lib/http";

const BASE = "/api/study-progress";

export async function fetchStudyProgress(): Promise<StudyProgressMap> {
  const { progress } = await get<{ progress: StudyProgressMap }>(BASE);
  return progress;
}

export interface SaveStudyInput {
  itemType: StudyItemType;
  itemSlug: string;
  mastery?: MasteryLevel;
  notes?: string | null;
  timeSeconds?: number;
  quiz?: { score: number; total: number };
  rubric?: { checked: string[]; score: number; max: number };
}

export async function saveStudyProgress(input: SaveStudyInput): Promise<StudyRecord> {
  const { progress } = await post<{ progress: StudyRecord }>(BASE, input);
  return progress;
}
