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
  companies?: string[];
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

export function saveCompanies(problemId: number, companies: string[]) {
  return saveProgress({ problemId, companies });
}

export function saveMastery(problemId: number, mastery: MasteryLevel, timeSeconds?: number) {
  return saveProgress({ problemId, mastery, ...(timeSeconds ? { timeSeconds } : {}) });
}

/**
 * Record a revision — the problem was reviewed, not re-solved.
 *
 * A distinct endpoint from `saveProgress` on purpose: going through the mastery
 * upsert would bump the solve counters and reset mastery, conflating the two
 * metrics the feature exists to keep apart.
 */
export async function reviseProblem(problemId: number): Promise<ProgressRecord> {
  const { progress } = await post<{ progress: ProgressRecord }>("/api/progress/revise", {
    problemId,
  });
  return progress;
}

/** Set or clear the manual "show me this again" flag. */
export async function flagProblemForReview(
  problemId: number,
  flagged: boolean
): Promise<ProgressRecord> {
  const res = await fetch("/api/progress/revise", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ problemId, flagged }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Could not update");
  return (await res.json()).progress;
}
