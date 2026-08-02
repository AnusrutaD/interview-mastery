"use client";
import { use, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { describeWatch } from "@/core/domain/watch";
import { formatClock } from "@/core/time/format";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { MasterySelector } from "@/features/problems/components/MasterySelector";
import { MarkdownNote } from "@/features/notes/components/MarkdownNote";
import { VideoPlayer } from "@/features/collections/components/VideoPlayer";
import { useCollection } from "@/features/collections/hooks/useCollection";
import { saveWatchProgress } from "@/features/collections/api/collection.client";
import { cn } from "@/lib/cn";

export default function WatchPage({
  params,
}: {
  params: Promise<{ id: string; itemId: string }>;
}) {
  const { id, itemId } = use(params);
  const router = useRouter();
  const session = useCollection(id);
  const { collection, items, loading, saving } = session;

  const [justCompleted, setJustCompleted] = useState(false);

  const item = useMemo(() => items.find((i) => i.id === itemId), [items, itemId]);
  const index = useMemo(() => items.findIndex((i) => i.id === itemId), [items, itemId]);
  const previous = index > 0 ? items[index - 1] : null;
  const next = index >= 0 && index < items.length - 1 ? items[index + 1] : null;

  const handleProgress = useCallback(
    async (state: { watchedSeconds: number; positionSeconds: number }) => {
      const result = await saveWatchProgress(itemId, state);
      if (result.complete) setJustCompleted(true);
    },
    [itemId]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <Spinner label="Loading video" />
      </div>
    );
  }

  if (!item || !collection) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Video not found</p>
          <Link href={`/collections/${id}`} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
            ← Back to list
          </Link>
        </div>
      </div>
    );
  }

  const videoId = item.externalId;
  const progress = describeWatch(
    { watchedSeconds: item.watchedSeconds, positionSeconds: item.positionSeconds },
    item.durationSeconds
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <nav className="text-xs text-gray-400 dark:text-gray-500 mb-3 flex items-center gap-1.5">
          <Link href="/collections" className="hover:text-blue-500 transition-colors">My Lists</Link>
          <span>/</span>
          <Link href={`/collections/${id}`} className="hover:text-blue-500 transition-colors">
            {collection.name}
          </Link>
          <span>/</span>
          <span className="text-gray-600 dark:text-gray-300 truncate">{item.title}</span>
        </nav>

        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">{item.title}</h1>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
          {index + 1} of {items.length}
          {item.durationSeconds && ` · ${formatClock(item.durationSeconds)}`}
        </p>

        {(justCompleted || progress.complete) && (
          <div className="mb-4 flex items-center gap-2 px-4 py-2.5 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-xl">
            <span aria-hidden>✅</span>
            <p className="text-xs font-semibold text-green-700 dark:text-green-300">
              Marked complete — you watched enough of this one.
            </p>
            {next && (
              <button
                type="button"
                onClick={() => router.push(`/collections/${id}/watch/${next.id}`)}
                className="ml-auto text-xs font-semibold bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg transition-colors shrink-0"
              >
                Next video →
              </button>
            )}
          </div>
        )}

        <Card className="mb-4">
          {videoId ? (
            <VideoPlayer
              videoId={videoId}
              title={item.title}
              durationSeconds={item.durationSeconds}
              initialWatchedSeconds={item.watchedSeconds}
              initialPositionSeconds={item.positionSeconds}
              onProgress={handleProgress}
              onComplete={() => {
                setJustCompleted(true);
                session.refresh();
              }}
            />
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                This item has no video id, so it cannot be played in-app.
              </p>
              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Open the original →
                </a>
              )}
            </div>
          )}
        </Card>

        <Card className="mb-4">
          <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">
            How well do you know this?
          </p>
          <MasterySelector
            value={item.mastery}
            onChange={(level) => void session.setMastery(item.id, level)}
            size="md"
          />
          <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-2">
            Set automatically once you finish watching — override it here any time.
          </p>
        </Card>

        <div className="mb-4">
          <MarkdownNote
            value={item.notes ?? ""}
            onSave={(notes) => session.setNotes(item.id, notes)}
            saving={saving}
          />
        </div>

        <nav className="grid grid-cols-2 gap-3">
          <NeighbourLink collectionId={id} item={previous} direction="previous" />
          <NeighbourLink collectionId={id} item={next} direction="next" />
        </nav>
      </div>
    </div>
  );
}

function NeighbourLink({
  collectionId,
  item,
  direction,
}: {
  collectionId: string;
  item: { id: string; title: string } | null;
  direction: "previous" | "next";
}) {
  const isPrevious = direction === "previous";
  if (!item) {
    return (
      <div
        aria-hidden
        className="border border-dashed border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3"
      >
        <span className="text-xs text-gray-300 dark:text-gray-700">
          {isPrevious ? "Start of list" : "End of list"}
        </span>
      </div>
    );
  }

  return (
    <Link
      href={`/collections/${collectionId}/watch/${item.id}`}
      className={cn(
        "group border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3",
        "bg-white dark:bg-gray-900 hover:border-red-300 dark:hover:border-red-600 transition-colors",
        !isPrevious && "text-right"
      )}
    >
      <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">
        {isPrevious ? "← Previous" : "Next →"}
      </p>
      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors truncate">
        {item.title}
      </p>
    </Link>
  );
}
