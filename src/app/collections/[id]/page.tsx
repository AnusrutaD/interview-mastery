"use client";
import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ITEM_KIND_CONFIG, type ItemWithProgress } from "@/core/domain/collection";
import { reviewLabel } from "@/core/domain/review";
import { formatDuration, formatRelative } from "@/core/time/format";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Spinner } from "@/components/ui/Spinner";
import { MasterySelector } from "@/features/problems/components/MasterySelector";
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
          <ImportPanel onImport={session.importText} saving={saving} />
        )}

        {stats.total === 0 ? null : (
          <Card padded={false} className="overflow-hidden">
            <ul>
              {items.map((item, index) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  last={index === items.length - 1}
                  onSetMastery={(mastery) => void session.setMastery(item.id, mastery)}
                  onRemove={() => void session.removeItem(item.id)}
                />
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}

function ItemRow({
  item,
  last,
  onSetMastery,
  onRemove,
}: {
  item: ItemWithProgress;
  last: boolean;
  onSetMastery: (mastery: ItemWithProgress["mastery"]) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const status = reviewLabel(item.mastery, item.lastPracticedAt);

  return (
    <li className={cn(!last && "border-b border-gray-100 dark:border-gray-800")}>
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="text-sm shrink-0" aria-hidden title={ITEM_KIND_CONFIG[item.kind].label}>
            {ITEM_KIND_CONFIG[item.kind].icon}
          </span>

          {item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate"
            >
              {item.title}
            </a>
          ) : (
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
              {item.title}
            </span>
          )}

          {item.difficulty && (
            <span className="text-[10px] text-gray-400 dark:text-gray-600 shrink-0">
              {item.difficulty}
            </span>
          )}
          {item.due && (
            <span className="text-[10px] font-semibold text-red-500 shrink-0" title={status ?? "Due"}>
              🔴 due
            </span>
          )}

          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="ml-auto text-xs text-gray-300 dark:text-gray-700 hover:text-gray-500 transition-colors shrink-0"
            aria-expanded={expanded}
          >
            {expanded ? "▲" : "▼"}
          </button>
        </div>

        <MasterySelector value={item.mastery} onChange={onSetMastery} />

        {expanded && (
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-4 flex-wrap text-[11px] text-gray-400 dark:text-gray-500">
            {item.lastPracticedAt && <span>Last practised {formatRelative(item.lastPracticedAt)}</span>}
            {item.repeatCount > 0 && <span>{item.repeatCount}× reviewed</span>}
            {item.totalTimeSeconds > 0 && <span>{formatDuration(item.totalTimeSeconds)} spent</span>}
            {item.topic && <span>{item.topic}</span>}
            <button
              type="button"
              onClick={onRemove}
              className="ml-auto text-gray-300 dark:text-gray-700 hover:text-red-500 transition-colors"
            >
              Remove
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
