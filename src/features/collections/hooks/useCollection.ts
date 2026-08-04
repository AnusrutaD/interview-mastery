"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  EMPTY_ITEM_RECORD,
  joinItems,
  summarizeCollection,
  suggestNextItem,
  toTargetContributions,
  type Collection,
  type Item,
  type ItemProgressMap,
} from "@/core/domain/collection";
import { measureTarget, toTarget, type Target, type TargetProgress } from "@/core/domain/target";
import type { MasteryLevel } from "@/core/domain/mastery";
import {
  fetchCollection,
  importText as importTextRequest,
  importPlaylist as importPlaylistRequest,
  saveItemProgress,
  updateCollection,
  deleteItem as deleteItemRequest,
  type ImportResponse,
} from "../api/collection.client";

export interface UseCollectionResult {
  collection: Collection | null;
  items: ReturnType<typeof joinItems>;
  stats: ReturnType<typeof summarizeCollection>;
  /** The list's configured target, or null if the user opted out of pacing. */
  target: Target | null;
  targetProgress: TargetProgress | null;
  nextItem: ReturnType<typeof suggestNextItem>;
  loading: boolean;
  saving: boolean;
  error: string | null;
  isAuthenticated: boolean;
  refresh: () => void;
  /** Pass null to clear the target entirely. */
  setTarget: (target: Target | null) => Promise<void>;
  setMastery: (itemId: string, mastery: MasteryLevel) => Promise<void>;
  setNotes: (itemId: string, notes: string) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  importText: (text: string) => Promise<ImportResponse>;
  importPlaylist: (url: string) => Promise<import("../api/collection.client").PlaylistImportResponse>;
}

export function useCollection(collectionId: string): UseCollectionResult {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";

  const [collection, setCollection] = useState<Collection | null>(null);
  const [rawItems, setRawItems] = useState<Item[]>([]);
  const [progress, setProgress] = useState<ItemProgressMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    fetchCollection(collectionId)
      .then((data) => {
        setCollection(data.collection);
        setRawItems(data.items);
        setProgress(data.progress);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [collectionId, isAuthenticated]);

  useEffect(() => {
    if (status === "loading") return;
    refresh();
  }, [status, refresh]);

  const setMastery = useCallback(
    async (itemId: string, mastery: MasteryLevel) => {
      const previous = progress[itemId];
      // Optimistic — clicking a mastery chip should feel instant.
      setProgress((current) => ({
        ...current,
        [itemId]: {
          // Spreading the existing record keeps fields this action does not own
          // — watch state, revision history — instead of resetting them, and
          // means a new field cannot be silently dropped here again.
          ...(current[itemId] ?? EMPTY_ITEM_RECORD),
          mastery,
          repeatCount: (current[itemId]?.repeatCount ?? 0) + 1,
          lastPracticedAt: new Date().toISOString(),
          // Solving satisfies a manual review request, same as revising.
          flaggedForReviewAt: null,
        },
      }));

      setSaving(true);
      try {
        const saved = await saveItemProgress(itemId, { mastery });
        setProgress((current) => ({ ...current, [itemId]: saved }));
        setError(null);
      } catch (err) {
        setProgress((current) => {
          const rolledBack = { ...current };
          if (previous) rolledBack[itemId] = previous;
          else delete rolledBack[itemId];
          return rolledBack;
        });
        setError(err instanceof Error ? err.message : "Could not save");
      } finally {
        setSaving(false);
      }
    },
    [progress]
  );

  const setNotes = useCallback(async (itemId: string, notes: string) => {
    setSaving(true);
    try {
      const saved = await saveItemProgress(itemId, { notes });
      setProgress((current) => ({ ...current, [itemId]: saved }));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save notes");
    } finally {
      setSaving(false);
    }
  }, []);

  const removeItem = useCallback(async (itemId: string) => {
    setSaving(true);
    try {
      await deleteItemRequest(itemId);
      setRawItems((current) => current.filter((i) => i.id !== itemId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove item");
    } finally {
      setSaving(false);
    }
  }, []);

  const importText = useCallback(
    async (text: string) => {
      const result = await importTextRequest(collectionId, text);
      // Refetch rather than merging locally: the server owns positions and
      // de-duplication, so its view is the only trustworthy one.
      refresh();
      return result;
    },
    [collectionId, refresh]
  );

  const importPlaylist = useCallback(
    async (url: string) => {
      const result = await importPlaylistRequest(collectionId, url);
      refresh();
      return result;
    },
    [collectionId, refresh]
  );

  const setTarget = useCallback(
    async (target: Target | null) => {
      setSaving(true);
      try {
        const saved = await updateCollection(collectionId, {
          targetPeriod: target?.period ?? null,
          targetUnit: target?.unit ?? null,
          targetValue: target?.value ?? null,
          // Kept in step so anything still reading the legacy column — the
          // collections index cards — agrees with what the detail page shows.
          dailyTarget:
            target && target.period === "daily" && target.unit === "count" ? target.value : null,
        });
        setCollection(saved);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save target");
      } finally {
        setSaving(false);
      }
    },
    [collectionId]
  );

  const items = useMemo(() => joinItems(rawItems, progress), [rawItems, progress]);
  const stats = useMemo(() => summarizeCollection(items), [items]);

  const target = useMemo(
    () =>
      collection
        ? toTarget({
            period: collection.targetPeriod,
            unit: collection.targetUnit,
            // Lists created before periods existed only have `dailyTarget`.
            // Reading through to it means their target keeps working untouched.
            value: collection.targetValue ?? collection.dailyTarget,
          })
        : null,
    [collection]
  );

  const targetProgress = useMemo(
    () => (target ? measureTarget(target, toTargetContributions(items)) : null),
    [target, items]
  );

  const nextItem = useMemo(() => suggestNextItem(items), [items]);

  return {
    collection,
    items,
    stats,
    target,
    targetProgress,
    nextItem,
    loading,
    saving,
    error,
    isAuthenticated,
    refresh,
    setTarget,
    setMastery,
    setNotes,
    removeItem,
    importText,
    importPlaylist,
  };
}
