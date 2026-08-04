"use client";
import { useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ITEM_KIND_CONFIG, type ItemWithProgress } from "@/core/domain/collection";
import { moveItem, sortByPosition, toPositionUpdates } from "@/core/domain/ordering";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

/**
 * Reorder mode: a compact, sortable view of the whole list.
 *
 * Separate from `ItemTable` rather than bolted onto it. A row that is both
 * draggable and covered in buttons is a row where every press is ambiguous —
 * did you mean to drag or to tap? Stripping the row back to a handle and a
 * title while reordering removes the ambiguity entirely, and makes far more of
 * the list visible at once, which is what a reorder actually needs.
 *
 * Order is persisted on every drop rather than behind a Save button: a drag is
 * already an explicit gesture, and a list that silently discards a rearrangement
 * on navigation is worse than one extra request.
 */
export function ReorderList({
  items,
  onReorder,
  onInsertAfter,
  onExit,
  disabled,
}: {
  items: ItemWithProgress[];
  onReorder: (updates: { id: string; position: number }[]) => void;
  /** Null anchors the insert at the very start of the list. */
  onInsertAfter?: (afterId: string | null) => void;
  onExit: () => void;
  disabled?: boolean;
}) {
  // Local order so a drag feels instant; the server is told afterwards.
  const [order, setOrder] = useState(() => sortByPosition(items).map((item) => item.id));

  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  // Reconcile against the source of truth: an item deleted or imported in
  // another tab should not leave a dangling id here.
  const ordered = useMemo(() => {
    const known = order.filter((id) => byId.has(id));
    const missing = sortByPosition(items)
      .map((item) => item.id)
      .filter((id) => !known.includes(id));
    return [...known, ...missing];
  }, [order, byId, items]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Without a small threshold, every tap on a row registers as a drag and
      // the buttons underneath become unusable on touch.
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const commit = (nextIds: string[]) => {
    setOrder(nextIds);
    // Positions are derived from the new index, so the domain stays the single
    // source of truth for what "position" means.
    const updates = toPositionUpdates(
      nextIds.map((id, index) => ({ id, position: byId.get(id)?.position ?? index }))
    );
    if (updates.length > 0) onReorder(updates);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const toIndex = ordered.indexOf(String(over.id));
    const moved = moveItem(
      ordered.map((id, index) => ({ id, position: index })),
      String(active.id),
      toIndex
    );
    commit(moved.map((entry) => entry.id));
  };

  const move = (id: string, direction: "up" | "down") => {
    const from = ordered.indexOf(id);
    const moved = moveItem(
      ordered.map((entry, index) => ({ id: entry, position: index })),
      id,
      from + (direction === "up" ? -1 : 1)
    );
    commit(moved.map((entry) => entry.id));
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Reordering · {ordered.length} items
        </span>
        <button
          type="button"
          onClick={onExit}
          className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
        >
          Done
        </button>
      </div>

      <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-3">
        Drag the handle, or use the arrows. Changes save as you go.
      </p>

      {onInsertAfter && (
        <InsertHere onClick={() => onInsertAfter(null)} disabled={disabled} label="Insert at top" />
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ordered} strategy={verticalListSortingStrategy}>
          <Card padded={false} className="overflow-hidden">
            <ul>
              {ordered.map((id, index) => {
                const item = byId.get(id);
                if (!item) return null;
                return (
                  <SortableRow
                    key={id}
                    item={item}
                    index={index}
                    last={index === ordered.length - 1}
                    disabled={disabled}
                    onMoveUp={index > 0 ? () => move(id, "up") : undefined}
                    onMoveDown={index < ordered.length - 1 ? () => move(id, "down") : undefined}
                    onInsertAfter={onInsertAfter ? () => onInsertAfter(id) : undefined}
                  />
                );
              })}
            </ul>
          </Card>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortableRow({
  item,
  index,
  last,
  disabled,
  onMoveUp,
  onMoveDown,
  onInsertAfter,
}: {
  item: ItemWithProgress;
  index: number;
  last: boolean;
  disabled?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onInsertAfter?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "bg-white dark:bg-gray-900",
        !last && "border-b border-gray-100 dark:border-gray-800",
        isDragging && "opacity-60 shadow-lg relative z-10"
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        {/* The handle carries the drag listeners, not the row — otherwise the
            arrow and insert buttons could never be pressed. */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${item.title}`}
          className="cursor-grab active:cursor-grabbing text-gray-300 dark:text-gray-600 hover:text-gray-500 px-1 touch-none"
        >
          ⠿
        </button>

        <span className="text-xs text-gray-300 dark:text-gray-700 tabular-nums w-6 shrink-0">
          {index + 1}
        </span>

        <span className="text-sm shrink-0" aria-hidden>
          {ITEM_KIND_CONFIG[item.kind].icon}
        </span>

        <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">
          {item.title}
        </span>

        <div className="flex items-center gap-0.5 shrink-0">
          <ArrowButton onClick={onMoveUp} disabled={disabled} label="Move up">
            ▲
          </ArrowButton>
          <ArrowButton onClick={onMoveDown} disabled={disabled} label="Move down">
            ▼
          </ArrowButton>
        </div>
      </div>

      {onInsertAfter && (
        <InsertHere onClick={onInsertAfter} disabled={disabled} label="Insert below" compact />
      )}
    </li>
  );
}

function ArrowButton({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !onClick}
      aria-label={label}
      className="text-[10px] w-6 h-6 rounded text-gray-400 dark:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 disabled:opacity-25 disabled:hover:bg-transparent transition-colors"
    >
      {children}
    </button>
  );
}

/** A thin affordance between rows — visible on hover, out of the way otherwise. */
function InsertHere({
  onClick,
  disabled,
  label,
  compact,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("group flex items-center gap-2", compact ? "px-3 pb-1" : "py-1")}>
      <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800 group-hover:bg-blue-300 dark:group-hover:bg-blue-700 transition-colors" />
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="text-[10px] font-medium text-gray-300 dark:text-gray-700 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors disabled:opacity-40"
      >
        + {label}
      </button>
      <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800 group-hover:bg-blue-300 dark:group-hover:bg-blue-700 transition-colors" />
    </div>
  );
}
