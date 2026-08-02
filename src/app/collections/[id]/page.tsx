"use client";
import { use, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ItemWithProgress } from "@/core/domain/collection";
import {
  applyItemFilters,
  DEFAULT_ITEM_FILTERS,
  deriveFacets,
  isFiltering,
  reconcileFilters,
  type ItemFilterState,
} from "@/core/domain/itemFilter";
import { formatDuration } from "@/core/time/format";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Spinner } from "@/components/ui/Spinner";
import { ItemFilters } from "@/features/items/components/ItemFilters";
import { ItemTable } from "@/features/items/components/ItemTable";
import { useCollection } from "@/features/collections/hooks/useCollection";
import { ImportPanel } from "@/features/collections/components/ImportPanel";
import { deleteCollection, updateCollection } from "@/features/collections/api/collection.client";
import { cn } from "@/lib/cn";

export default function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const session = useCollection(id);
  const { collection, items, stats, targetProgress, nextItem, loading, saving, error } = session;

  const [showImport, setShowImport] = useState(false);
  const [editingTarget, setEditingTarget] = useState(false);
  const [filters, setFilters] = useState<ItemFilterState>(DEFAULT_ITEM_FILTERS);

  // Facets come from the items themselves, so a playlist and a problem set get
  // different controls without either page knowing what it is looking at.
  const facets = useMemo(() => deriveFacets(items), [items]);
  // Drop any filter the current items can no longer satisfy — otherwise
  // removing the last Hard item leaves the list stuck on an empty filter.
  const activeFilters = useMemo(() => reconcileFilters(filters, facets), [filters, facets]);
  const visibleItems = useMemo(
    () => applyItemFilters(items, activeFilters),
    [items, activeFilters]
  );

  const setFilter = useCallback(
    <K extends keyof ItemFilterState>(key: K, next: ItemFilterState[K]) =>
      setFilters((current) => ({ ...current, [key]: next })),
    []
  );
  const resetFilters = useCallback(() => setFilters(DEFAULT_ITEM_FILTERS), []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <Spinner label="Loading list" />
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            {error ?? "List not found"}
          </p>
          <Link href="/collections" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
            ← Back to my lists
          </Link>
        </div>
      </div>
    );
  }

  const setTarget = async (value: number | null) => {
    await updateCollection(id, { dailyTarget: value });
    session.refresh();
    setEditingTarget(false);
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${collection.name}" and all its progress? This cannot be undone.`))
      return;
    await deleteCollection(id);
    router.push("/collections");
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8">
        <nav className="text-xs text-gray-400 dark:text-gray-500 mb-3 flex items-center gap-1.5">
          <Link href="/" className="hover:text-blue-500 transition-colors">Tracks</Link>
          <span>/</span>
          <Link href="/collections" className="hover:text-blue-500 transition-colors">My Lists</Link>
          <span>/</span>
          <span className="text-gray-600 dark:text-gray-300 truncate">{collection.name}</span>
        </nav>

        {error && (
          <div
            role="alert"
            className="mb-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl px-4 py-2.5 text-xs text-red-700 dark:text-red-400"
          >
            {error}
          </div>
        )}

        <header className="flex items-start gap-3 mb-5">
          <span className="text-3xl shrink-0" aria-hidden>{collection.icon ?? "📚"}</span>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {collection.name}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {stats.completed} of {stats.total} done
              {stats.due > 0 && (
                <span className="text-red-500 font-medium"> · {stats.due} due for review</span>
              )}
              {stats.totalTimeSeconds > 0 && ` · ${formatDuration(stats.totalTimeSeconds)} spent`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void remove()}
            className="text-xs text-gray-400 dark:text-gray-600 hover:text-red-500 transition-colors shrink-0"
          >
            Delete
          </button>
        </header>

        {stats.total > 0 && (
          <Card className="mb-4">
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>Progress</span>
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                {stats.completionPercent}%
              </span>
            </div>
            <ProgressBar value={stats.attempted} max={stats.total} height="h-2.5" className="mb-4" />

            <div className="flex items-center gap-3 flex-wrap">
              {targetProgress ? (
                <div
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs",
                    targetProgress.met
                      ? "bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300"
                      : "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                  )}
                >
                  <span aria-hidden>{targetProgress.met ? "🎉" : "🎯"}</span>
                  <span className="font-semibold">
                    {targetProgress.done} / {targetProgress.target} today
                  </span>
                </div>
              ) : (
                <span className="text-xs text-gray-400 dark:text-gray-600">No daily target</span>
              )}

              {editingTarget ? (
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 5, 10].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => void setTarget(n)}
                      className="text-xs w-7 h-7 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-blue-400 transition-colors"
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => void setTarget(null)}
                    className="text-xs px-2 h-7 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-red-300 transition-colors"
                  >
                    None
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingTarget(true)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {targetProgress ? "Change target" : "Set a daily target"}
                </button>
              )}
            </div>
          </Card>
        )}

        {nextItem && (
          <Card padded={false} className="p-4 mb-4 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30">
            <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-1">
              {nextItem.due ? "Due for review" : "Next up"}
            </p>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
                {nextItem.title}
              </p>
              {nextItem.url && (
                <a
                  href={nextItem.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors shrink-0"
                >
                  Open →
                </a>
              )}
            </div>
          </Card>
        )}

        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Items
          </h2>
          <button
            type="button"
            onClick={() => setShowImport((v) => !v)}
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            {showImport ? "Hide import" : "+ Add items"}
          </button>
        </div>

        {(showImport || stats.total === 0) && (
          <ImportPanel
            onImport={session.importText}
            onImportPlaylist={session.importPlaylist}
            saving={saving}
          />
        )}

        {stats.total > 0 && (
          <>
            <ItemFilters
              value={activeFilters}
              facets={facets}
              onChange={setFilter}
              onReset={resetFilters}
              resultCount={visibleItems.length}
              totalCount={items.length}
            />

            <ItemTable
              items={visibleItems}
              hrefFor={(item) =>
                item.kind === "video" && item.externalId
                  ? `/collections/${collection.id}/watch/${item.id}`
                  : item.url
              }
              onSetMastery={(itemId, mastery) => void session.setMastery(itemId, mastery)}
              onRemove={(itemId) => void session.removeItem(itemId)}
              filtered={isFiltering(activeFilters)}
              onClearFilters={resetFilters}
            />
          </>
        )}
      </div>
    </div>
  );
}

