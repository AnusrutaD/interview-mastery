/**
 * The only module in the app that knows the shape of the progress API.
 * Every component goes through these functions, so an endpoint change is a
 * one-file edit instead of a hunt through thirteen inline fetch calls.
 */
import type { MasteryLevel } from "@/core/domain/mastery";
import type { ProgressMap, ProgressRecord } from "@/core/domain/progress";
import { get, post, queryString } from "@/lib/http";

const BASE = "/api/progress";

export interface FetchProgressOptions {
  category?: string;
  ids?: number[];
}

export async function fetchProgress(options: FetchProgressOptions = {}): Promise<ProgressMap> {
  const url =
    BASE +
    queryString({
      category: options.category,
      ids: options.ids?.length ? options.ids.join(",") : undefined,
    });
  const { progress } = await get<{ progress: ProgressMap }>(url);
  return progress;
}

export async function fetchProblemProgress(problemId: number): Promise<ProgressRecord> {
  const { progress } = await get<{ progress: ProgressRecord }>(`${BASE}/${problemId}`);
  return progress;
}

export interface SaveProgressInput {
  problemId: number;
  mastery?: MasteryLevel;
  notes?: string | null;
  /** Elapsed seconds to add to the problem's running total. */
  timeSeconds?: number;
}

export async function saveProgress(
  input: SaveProgressInput
): Promise<ProgressRecord & { problemId: number }> {
  const { progress } = await post<{ progress: ProgressRecord & { problemId: number } }>(
    BASE,
    input
  );
  return progress;
}

/** Record elapsed time without touching mastery — see upsertProgress docs. */
export function saveTimeOnly(problemId: number, timeSeconds: number) {
  return saveProgress({ problemId, timeSeconds });
}

export function saveNotes(problemId: number, notes: string) {
  return saveProgress({ problemId, notes });
}

export function saveMastery(problemId: number, mastery: MasteryLevel, timeSeconds?: number) {
  return saveProgress({ problemId, mastery, ...(timeSeconds ? { timeSeconds } : {}) });
}
