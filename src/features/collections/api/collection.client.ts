import type { MasteryLevel } from "@/core/domain/mastery";
import type { Collection, Item, ItemProgressMap, ItemRecord } from "@/core/domain/collection";
import type { TargetPeriod, TargetUnit } from "@/core/domain/target";
import type { ParsedItem } from "@/core/domain/itemImport";
import type { ImportIssue } from "@/core/domain/itemImport";
import type { CollectionSummary } from "@/server/services/collection.service";
import { get, post } from "@/lib/http";

const BASE = "/api/collections";

export async function fetchCollections(includeArchived = false): Promise<CollectionSummary[]> {
  const { collections } = await get<{ collections: CollectionSummary[] }>(
    `${BASE}${includeArchived ? "?archived=true" : ""}`
  );
  return collections;
}

export interface CollectionDetailPayload {
  collection: Collection;
  items: Item[];
  progress: ItemProgressMap;
}

export function fetchCollection(id: string): Promise<CollectionDetailPayload> {
  return get<CollectionDetailPayload>(`${BASE}/${id}`);
}

export interface CreateCollectionBody {
  name: string;
  description?: string | null;
  source?: Collection["source"];
  sourceUrl?: string | null;
  /** Legacy daily count target. Superseded by the target* fields below. */
  dailyTarget?: number | null;
  targetPeriod?: TargetPeriod | null;
  targetUnit?: TargetUnit | null;
  targetValue?: number | null;
  icon?: string | null;
}

export async function createCollection(body: CreateCollectionBody): Promise<Collection> {
  const { collection } = await post<{ collection: Collection }>(BASE, body);
  return collection;
}

export async function updateCollection(
  id: string,
  body: Partial<CreateCollectionBody> & { archived?: boolean; position?: number }
): Promise<Collection> {
  const res = await fetch(`${BASE}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Update failed");
  return (await res.json()).collection;
}

export async function deleteCollection(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Delete failed");
}

export interface ImportResponse {
  added: number;
  skipped: number;
  total: number;
  issues: ImportIssue[];
  duplicatesInPaste: number;
}

/**
 * Send the raw paste — the server re-parses so both sides agree on the rules.
 *
 * `insertAfter` slots the items in after that id; null means the very start.
 * Omitting it appends, which is what a plain bulk paste should do.
 */
export function importText(
  collectionId: string,
  text: string,
  insertAfter?: string | null
): Promise<ImportResponse> {
  return post<ImportResponse>(`${BASE}/${collectionId}/items`, {
    text,
    ...(insertAfter !== undefined && { insertAfter }),
  });
}

/** Persist a manual reorder. Takes only the positions that actually changed. */
export async function reorderItems(
  collectionId: string,
  updates: { id: string; position: number }[]
): Promise<void> {
  const res = await fetch(`${BASE}/${collectionId}/order`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ updates }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Reorder failed");
}

export function importParsed(collectionId: string, items: ParsedItem[]): Promise<ImportResponse> {
  return post<ImportResponse>(`${BASE}/${collectionId}/items`, { items });
}

export async function deleteItem(itemId: string): Promise<void> {
  const res = await fetch(`/api/items/${itemId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Could not remove item");
}

export interface SaveItemProgressBody {
  mastery?: MasteryLevel;
  notes?: string | null;
  companies?: string[];
  timeSeconds?: number;
}

export async function saveItemProgress(
  itemId: string,
  body: SaveItemProgressBody
): Promise<ItemRecord> {
  const { progress } = await post<{ progress: ItemRecord }>(
    `/api/items/${itemId}/progress`,
    body
  );
  return progress;
}

export interface PlaylistImportResponse extends ImportResponse {
  playlistId: string;
  truncated: boolean;
}

/** Import a YouTube playlist's video metadata into a collection. */
export function importPlaylist(
  collectionId: string,
  url: string
): Promise<PlaylistImportResponse> {
  return post<PlaylistImportResponse>(`${BASE}/${collectionId}/import-playlist`, { url });
}

export interface WatchProgressResponse extends ItemRecord {
  complete: boolean;
}

/** Throttled ping from the video player. Completion is decided server-side. */
export async function saveWatchProgress(
  itemId: string,
  body: { watchedSeconds: number; positionSeconds: number }
): Promise<WatchProgressResponse> {
  const { progress } = await post<{ progress: WatchProgressResponse }>(
    `/api/items/${itemId}/watch`,
    body
  );
  return progress;
}

/** Record a revision against a collection item. */
export async function reviseItem(itemId: string): Promise<ItemRecord> {
  const { progress } = await post<{ progress: ItemRecord }>(
    `/api/items/${itemId}/revise`,
    {}
  );
  return progress;
}

/** Set or clear an item's manual review flag. */
export async function flagItemForReview(itemId: string, flagged: boolean): Promise<ItemRecord> {
  const res = await fetch(`/api/items/${itemId}/revise`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ flagged }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Could not update");
  return (await res.json()).progress;
}
