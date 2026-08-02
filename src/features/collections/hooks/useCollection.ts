"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  joinItems,
  summarizeCollection,
  dailyTargetProgress,
  suggestNextItem,
  type Collection,
  type Item,
  type ItemProgressMap,
} from "@/core/domain/collection";
import type { MasteryLevel } from "@/core/domain/mastery";
import {
  fetchCollection,
  importText as importTextRequest,
  importPlaylist as importPlaylistRequest,
  saveItemProgress,
  deleteItem as deleteItemRequest,
  type ImportResponse,
} from "../api/collection.client";

export interface UseCollectionResult {
  collection: Collection | null;
  items: ReturnType<typeof joinItems>;
  stats: ReturnType<typeof summarizeCollection>;
  targetProgress: ReturnType<typeof dailyTargetProgress>;
  nextItem: ReturnType<typeof suggestNextItem>;
  loading: boolean;
  saving: boolean;
  error: string | null;
  isAuthenticated: boolean;
  refresh: () => void;
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
          mastery,
          notes: current[itemId]?.notes ?? null,
          companies: current[itemId]?.companies ?? [],
          repeatCount: (current[itemId]?.repeatCount ?? 0) + 1,
          totalTimeSeconds: current[itemId]?.totalTimeSeconds ?? 0,
          lastPracticedAt: new Date().toISOString(),
          // Watch state is owned by the player, never by a mastery click.
          watchedSeconds: current[itemId]?.watchedSeconds ?? 0,
          positionSeconds: current[itemId]?.positionSeconds ?? 0,
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

  const items = useMemo(() => joinItems(rawItems, progress), [rawItems, progress]);
  const stats = useMemo(() => summarizeCollection(items), [items]);
  const targetProgress = useMemo(
    () => (collection ? dailyTargetProgress(collection, stats) : null),
    [collection, stats]
  );
  const nextItem = useMemo(() => suggestNextItem(items), [items]);

  return {
    collection,
    items,
    stats,
    targetProgress,
    nextItem,
    loading,
    saving,
    error,
    isAuthenticated,
    refresh,
    setMastery,
    setNotes,
    removeItem,
    importText,
    importPlaylist,
  };
}
