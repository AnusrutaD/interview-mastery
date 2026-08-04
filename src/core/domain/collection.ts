/**
 * The generalised study model: user-owned collections of referenced items.
 *
 * This supersedes the hardcoded `Problem` catalogue. A collection is a list the
 * user brought — a problem set, a video playlist, a reading list — and the app
 * tracks progress against it. Reference data only: title, url, external id.
 * The content itself always lives at its source.
 *
 * Deliberately reuses the existing domain vocabulary. `mastery`, `review` and
 * `timer` operate on levels and timestamps, not on problems, so spaced
 * repetition, the solve timer, streaks and activity all apply to any item kind
 * without modification.
 */
import { isAttempted, isSolved, type MasteryLevel } from "./mastery";
import { isDue } from "./review";
import { isISTToday } from "../time/ist";

/* ── Kinds and sources ────────────────────────────────────────────────────── */

export const ITEM_KINDS = ["problem", "video", "article", "other"] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export const COLLECTION_SOURCES = [
  "builtin",
  "manual",
  "csv",
  "leetcode",
  "youtube",
  "gfg",
] as const;
export type CollectionSource = (typeof COLLECTION_SOURCES)[number];

export const ITEM_KIND_CONFIG: Record<ItemKind, { label: string; icon: string }> = {
  problem: { label: "Problem", icon: "⚡" },
  video: { label: "Video", icon: "▶️" },
  article: { label: "Article", icon: "📄" },
  other: { label: "Item", icon: "○" },
};

export const SOURCE_CONFIG: Record<CollectionSource, { label: string; icon: string }> = {
  builtin: { label: "Built-in", icon: "📦" },
  manual: { label: "Manual", icon: "✏️" },
  csv: { label: "Imported", icon: "📋" },
  leetcode: { label: "LeetCode", icon: "🟠" },
  youtube: { label: "YouTube", icon: "▶️" },
  gfg: { label: "GeeksforGeeks", icon: "🟢" },
};

export function isItemKind(value: unknown): value is ItemKind {
  return typeof value === "string" && (ITEM_KINDS as readonly string[]).includes(value);
}

export function toItemKind(value: unknown): ItemKind {
  return isItemKind(value) ? value : "other";
}

export function isCollectionSource(value: unknown): value is CollectionSource {
  return typeof value === "string" && (COLLECTION_SOURCES as readonly string[]).includes(value);
}

export function toCollectionSource(value: unknown): CollectionSource {
  return isCollectionSource(value) ? value : "manual";
}

/* ── Models ───────────────────────────────────────────────────────────────── */

export interface Collection {
  id: string;
  name: string;
  description: string | null;
  source: CollectionSource;
  sourceUrl: string | null;
  templateKey: string | null;
  dailyTarget: number | null;
  weeklyTarget: number | null;
  targetPeriod: string | null;
  targetUnit: string | null;
  targetValue: number | null;
  position: number;
  icon: string | null;
  archived: boolean;
}

export interface Item {
  id: string;
  collectionId: string;
  title: string;
  url: string | null;
  kind: ItemKind;
  externalId: string | null;
  /** Runtime in seconds. Present for videos only. */
  durationSeconds: number | null;
  difficulty: string | null;
  topic: string | null;
  tags: string[];
  position: number;
  metadata: Record<string, unknown> | null;
}

/** A user's record against one item. Absent means never touched. */
export interface ItemRecord {
  mastery: MasteryLevel;
  notes: string | null;
  companies: string[];
  repeatCount: number;
  totalTimeSeconds: number;
  /** Set only on deliberate practice — drives review scheduling. */
  lastPracticedAt: string | null;
  /** Accumulated genuine playback. Seek-resistant; see core/domain/watch.ts. */
  watchedSeconds: number;
  /** Resume point. Follows seeks. */
  positionSeconds: number;
}

export const EMPTY_ITEM_RECORD: ItemRecord = {
  mastery: "unseen",
  notes: null,
  companies: [],
  repeatCount: 0,
  totalTimeSeconds: 0,
  lastPracticedAt: null,
  watchedSeconds: 0,
  positionSeconds: 0,
};

/** Item joined with the user's progress — what the UI renders. */
export interface ItemWithProgress extends Item, ItemRecord {
  due: boolean;
}

export type ItemProgressMap = Record<string, ItemRecord>;

export function joinItems(
  items: readonly Item[],
  progress: ItemProgressMap
): ItemWithProgress[] {
  return items.map((item) => {
    const record = progress[item.id] ?? EMPTY_ITEM_RECORD;
    return { ...item, ...record, due: isDue(record.mastery, record.lastPracticedAt) };
  });
}

/* ── Aggregation ──────────────────────────────────────────────────────────── */

export interface CollectionStats {
  total: number;
  /** Touched at all, including items marked unsolved. */
  attempted: number;
  /** Actually completed — excludes unsolved. */
  completed: number;
  unsolved: number;
  due: number;
  /** Completions today, in IST. Never counts a failed attempt. */
  completedToday: number;
  totalTimeSeconds: number;
  completionPercent: number;
  byKind: Record<ItemKind, number>;
}

export function summarizeCollection(items: readonly ItemWithProgress[]): CollectionStats {
  const byKind: Record<ItemKind, number> = { problem: 0, video: 0, article: 0, other: 0 };

  let attempted = 0;
  let completed = 0;
  let unsolved = 0;
  let due = 0;
  let completedToday = 0;
  let totalTimeSeconds = 0;

  for (const item of items) {
    byKind[item.kind] += 1;
    totalTimeSeconds += item.totalTimeSeconds;

    if (isAttempted(item.mastery)) attempted += 1;
    if (item.mastery === "unsolved") unsolved += 1;
    if (isSolved(item.mastery)) {
      completed += 1;
      if (item.lastPracticedAt && isISTToday(item.lastPracticedAt)) completedToday += 1;
    }
    if (item.due) due += 1;
  }

  return {
    total: items.length,
    attempted,
    completed,
    unsolved,
    due,
    completedToday,
    totalTimeSeconds,
    completionPercent: items.length ? Math.round((attempted / items.length) * 100) : 0,
    byKind,
  };
}

/**
 * Turn completed items into contributions a target can measure.
 *
 * The `seconds` figure needs a definition that is actually defensible, and this
 * is the honest one: **runtime of content completed**, not "time spent today".
 *
 * The distinction matters. Watch time accumulates across sessions — 20 minutes
 * yesterday plus 10 today is 30 on the record, with no per-day breakdown stored.
 * Attributing all 30 to today would inflate the number. So a minutes target
 * counts the length of the things you *finished* in the period, which is well
 * defined, matches what the user sees on each row, and never double counts.
 *
 * For an item with no runtime (a coding problem) the time actually spent on it
 * is the closest equivalent.
 */
export function toTargetContributions(
  items: readonly ItemWithProgress[]
): { at: string; seconds: number }[] {
  return items
    .filter((item) => isSolved(item.mastery) && item.lastPracticedAt)
    .map((item) => ({
      at: item.lastPracticedAt!,
      seconds: item.durationSeconds ?? item.totalTimeSeconds,
    }));
}

/**
 * Next item to work on: overdue reviews first (weakest mastery leads), then the
 * earliest untouched item in collection order.
 *
 * Order matters more than difficulty here — unlike the NeetCode set, a user's
 * imported list may have no difficulty data at all, but it always has a
 * sequence the author intended.
 */
export function suggestNextItem(items: readonly ItemWithProgress[]): ItemWithProgress | null {
  const dueNow = items.filter((i) => i.due);
  if (dueNow.length > 0) {
    const rank: Record<MasteryLevel, number> = {
      unseen: 0,
      unsolved: 1,
      learning: 2,
      familiar: 3,
      mastered: 4,
    };
    return [...dueNow].sort(
      (a, b) => rank[a.mastery] - rank[b.mastery] || a.position - b.position
    )[0];
  }

  const untouched = items
    .filter((i) => i.mastery === "unseen")
    .sort((a, b) => a.position - b.position);
  return untouched[0] ?? null;
}

/* ── Import de-duplication ────────────────────────────────────────────────── */

/**
 * Normalise a URL for de-duplication: drop the scheme, `www.`, tracking
 * parameters, trailing slash and fragment, and lowercase the host.
 *
 * The goal is that the same resource pasted twice in slightly different forms
 * imports once. Returns null for anything unparseable, which the caller treats
 * as "no dedupe key" rather than as an error.
 */
export function normaliseUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  const host = parsed.host.toLowerCase().replace(/^www\./, "");
  const path = parsed.pathname.replace(/\/+$/, "");

  // Keep meaningful query params (YouTube's ?v=), drop tracking noise.
  const keep = new URLSearchParams();
  for (const [key, value] of [...parsed.searchParams].sort()) {
    if (/^(utm_|fbclid|gclid|ref|si$)/i.test(key)) continue;
    keep.append(key, value);
  }
  const query = keep.toString();

  return `${host}${path}${query ? `?${query}` : ""}`;
}

/** The identity an import uses to avoid inserting the same item twice. */
export function dedupeKeyFor(input: {
  externalId?: string | null;
  url?: string | null;
}): string | null {
  if (input.externalId) return input.externalId.trim() || null;
  if (input.url) return normaliseUrl(input.url);
  return null;
}
