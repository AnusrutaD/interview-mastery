"use client";
import { useMemo, useState } from "react";
import type { ItemWithProgress } from "@/core/domain/collection";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { cn } from "@/lib/cn";

/**
 * Revision mode: work the due queue one item at a time.
 *
 * The list view can clear items inline, but a queue of thirty is a different
 * task from a list — you want one thing in front of you, its notes, and a way
 * to move on. Showing them all at once is what makes a backlog feel unclearable.
 *
 * Holds no data of its own: the queue is derived from the items passed in, so
 * an item cleared here disappears from the parent's due count without any
 * separate state to keep in sync.
 */
export function RevisionMode({
  items,
  onRevise,
  onToggleFlag,
  onExit,
  disabled,
}: {
  items: ItemWithProgress[];
  onRevise: (itemId: string) => void;
  onToggleFlag: (itemId: string, flagged: boolean) => void;
  onExit: () => void;
  disabled?: boolean;
}) {
  const due = useMemo(() => items.filter((item) => item.due), [items]);

  // Frozen on entry so the queue does not reorder or shrink underneath you as
  // you clear items — the position counter would otherwise jump around.
  const [queue] = useState(() => due.map((item) => item.id));
  const [index, setIndex] = useState(0);

  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const remaining = queue.filter((id) => byId.get(id)?.due);
  const current = byId.get(queue[index] ?? "");

  const cleared = queue.length - remaining.length;
  const atEnd = index >= queue.length - 1;

  const advance = () => setIndex((i) => Math.min(i + 1, queue.length - 1));

  if (queue.length === 0) {
    return (
      <Card>
        <EmptyState
          icon="🎉"
          title="Nothing due"
          hint="Come back when the schedule surfaces something, or flag an item to review it now."
          action={
            <button
              type="button"
              onClick={onExit}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Back to the list
            </button>
          }
        />
      </Card>
    );
  }

  // Finishing the queue should land somewhere, not leave the last item sitting
  // there with a Revised button that has already been pressed.
  if (!current || remaining.length === 0) {
    return (
      <Card>
        <EmptyState
          icon="✅"
          title={`Cleared ${cleared} of ${queue.length}`}
          action={
            <button
              type="button"
              onClick={onExit}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Done
            </button>
          }
        />
      </Card>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Revision · {index + 1} of {queue.length}
        </span>
        <button
          type="button"
          onClick={onExit}
          className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          Exit
        </button>
      </div>

      <ProgressBar value={cleared} max={queue.length} height="h-1.5" className="mb-3" />

      <Card className="mb-3">
        <div className="flex items-start gap-2 mb-2 flex-wrap">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex-1 min-w-0">
            {current.title}
          </h2>
          {current.flagged && (
            <span className="text-[10px] font-semibold text-purple-500 shrink-0">★ flagged</span>
          )}
          {current.difficulty && (
            <span className="text-[10px] text-gray-400 dark:text-gray-600 shrink-0">
              {current.difficulty}
            </span>
          )}
        </div>

        {current.notes ? (
          <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800 px-3 py-2.5 max-h-72 overflow-y-auto">
            {current.notes}
          </div>
        ) : (
          /* The honest empty state. Revising without notes means re-reading the
             problem itself, so the link matters more than a placeholder. */
          <p className="text-sm text-gray-400 dark:text-gray-600 italic">
            No notes yet — open it to refresh your memory.
          </p>
        )}

        {current.url && (
          <a
            href={current.url}
            target="_blank"
            rel="noreferrer"
            className="inline-block mt-3 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            Open the problem →
          </a>
        )}
      </Card>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            onRevise(current.id);
            if (!atEnd) advance();
          }}
          className="flex-1 min-w-36 text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50"
        >
          ✓ Revised
        </button>

        {/* Skipping leaves the item due on purpose — it is "not now", not
            "done", and quietly clearing it would lose the distinction. */}
        <button
          type="button"
          onClick={advance}
          disabled={atEnd}
          className="text-sm font-medium px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-40"
        >
          Skip
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() => onToggleFlag(current.id, !current.flagged)}
          className={cn(
            "text-sm font-medium px-4 py-2.5 rounded-xl border transition-colors disabled:opacity-50",
            current.flagged
              ? "bg-purple-600 border-purple-600 text-white hover:bg-purple-700"
              : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-purple-300 hover:text-purple-600"
          )}
        >
          {current.flagged ? "★" : "☆"}
        </button>
      </div>

      {cleared > 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3 text-center">
          {cleared} cleared this session
        </p>
      )}
    </div>
  );
}
