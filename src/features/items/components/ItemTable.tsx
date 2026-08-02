"use client";
import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ITEM_KIND_CONFIG, type ItemWithProgress } from "@/core/domain/collection";
import type { MasteryLevel } from "@/core/domain/mastery";
import { reviewLabel } from "@/core/domain/review";
import { formatClock, formatDuration, formatRelative } from "@/core/time/format";
import { describeWatch } from "@/core/domain/watch";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { MasterySelector } from "@/features/problems/components/MasterySelector";
import { cn } from "@/lib/cn";

const PAGE_SIZE = 10;

export interface ItemTableProps {
  items: ItemWithProgress[];
  /** Where the title links to. Falls back to the item's own url. */
  hrefFor?: (item: ItemWithProgress) => string | null;
  onSetMastery: (itemId: string, mastery: MasteryLevel) => void;
  onRemove?: (itemId: string) => void;
  /** Extra controls in the expanded row — "Detail →", "Watch →", etc. */
  actionsFor?: (item: ItemWithProgress) => ReactNode;
  disabled?: boolean;
  /** Shown when the list is empty *because of filters* rather than genuinely. */
  filtered?: boolean;
  onClearFilters?: () => void;
}

/**
 * The shared item list.
 *
 * Generic over `ItemWithProgress`, so a coding problem, a video and an article
 * all render through one component — the differences are data-driven (a video
 * shows its runtime and watch percentage; a problem shows difficulty) rather
 * than being separate implementations that drift apart.
 *
 * Paginated because a 49-video playlist or a 150-problem set is unusable as a
 * flat wall, and because a page boundary is a natural stopping point.
 */
export function ItemTable({
  items,
  hrefFor,
  onSetMastery,
  onRemove,
  actionsFor,
  disabled,
  filtered,
  onClearFilters,
}: ItemTableProps) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  // Clamp rather than store — deleting or filtering can drop the page count
  // below the current page, and a blank page reads as a bug.
  const safePage = Math.min(Math.max(1, page), totalPages);
  const paged = items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const tokens = useMemo(() => buildPagination(safePage, totalPages), [safePage, totalPages]);

  if (items.length === 0) {
    return (
      <Card padded={false}>
        {filtered ? (
          <EmptyState
            icon="🔍"
            title="Nothing matches those filters"
            action={
              onClearFilters ? (
                <button
                  type="button"
                  onClick={onClearFilters}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Clear filters
                </button>
              ) : undefined
            }
          />
        ) : (
          <EmptyState icon="📭" title="Nothing here yet" hint="Add items to get started." />
        )}
      </Card>
    );
  }

  return (
    <div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            Page {safePage} of {totalPages}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, items.length)} of{" "}
            {items.length}
          </span>
        </div>
      )}

      <Card padded={false} className="overflow-hidden mb-4">
        <ul>
          {paged.map((item, index) => (
            <ItemRow
              key={item.id}
              item={item}
              last={index === paged.length - 1}
              href={hrefFor?.(item) ?? item.url}
              actions={actionsFor?.(item)}
              onSetMastery={(mastery) => onSetMastery(item.id, mastery)}
              onRemove={onRemove ? () => onRemove(item.id) : undefined}
              disabled={disabled}
            />
          ))}
        </ul>
      </Card>

      {totalPages > 1 && (
        <nav className="flex items-center justify-between gap-2" aria-label="Pagination">
          <PageButton onClick={() => setPage(safePage - 1)} disabled={safePage === 1}>
            ← Prev
          </PageButton>

          <div className="flex items-center gap-1 flex-wrap justify-center">
            {tokens.map((token, i) =>
              token === "…" ? (
                <span key={`gap-${i}`} className="px-1 text-gray-400 text-xs">
                  …
                </span>
              ) : (
                <button
                  key={token}
                  type="button"
                  onClick={() => setPage(token)}
                  aria-current={token === safePage ? "page" : undefined}
                  className={cn(
                    "w-8 h-8 text-xs rounded-lg font-semibold transition-colors",
                    token === safePage
                      ? "bg-blue-600 text-white"
                      : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                  )}
                >
                  {token}
                </button>
              )
            )}
          </div>

          <PageButton onClick={() => setPage(safePage + 1)} disabled={safePage === totalPages}>
            Next →
          </PageButton>
        </nav>
      )}
    </div>
  );
}

function ItemRow({
  item,
  last,
  href,
  actions,
  onSetMastery,
  onRemove,
  disabled,
}: {
  item: ItemWithProgress;
  last: boolean;
  href: string | null;
  actions?: ReactNode;
  onSetMastery: (mastery: MasteryLevel) => void;
  onRemove?: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const status = reviewLabel(item.mastery, item.lastPracticedAt);

  const watch =
    item.kind === "video" && item.durationSeconds
      ? describeWatch(
          { watchedSeconds: item.watchedSeconds, positionSeconds: item.positionSeconds },
          item.durationSeconds
        )
      : null;

  // Internal routes must use Link for client navigation; external links open out.
  const isInternal = href?.startsWith("/") ?? false;

  return (
    <li className={cn(!last && "border-b border-gray-100 dark:border-gray-800")}>
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="text-sm shrink-0" aria-hidden title={ITEM_KIND_CONFIG[item.kind].label}>
            {ITEM_KIND_CONFIG[item.kind].icon}
          </span>

          {href ? (
            isInternal ? (
              <Link
                href={href}
                className="text-sm font-medium text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate"
              >
                {item.title}
              </Link>
            ) : (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate"
              >
                {item.title}
              </a>
            )
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

          {watch && (
            <span className="text-[10px] text-gray-400 dark:text-gray-600 shrink-0 tabular-nums">
              {formatClock(item.durationSeconds!)}
              {watch.percent > 0 && ` · ${watch.percent}%`}
            </span>
          )}

          {item.due && (
            <span
              className="text-[10px] font-semibold text-red-500 shrink-0"
              title={status ?? "Due"}
            >
              🔴 due
            </span>
          )}

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Collapse details" : "Expand details"}
            className="ml-auto text-xs text-gray-300 dark:text-gray-700 hover:text-gray-500 transition-colors shrink-0"
          >
            {open ? "▲" : "▼"}
          </button>
        </div>

        {/* A watched video gets a thin progress bar — the number alone is easy
            to miss when scanning a long list. */}
        {watch && watch.percent > 0 && (
          <div className="w-full h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mb-2">
            <div
              className={cn("h-full rounded-full", watch.complete ? "bg-green-500" : "bg-red-500")}
              style={{ width: `${watch.percent}%` }}
            />
          </div>
        )}

        <MasterySelector value={item.mastery} onChange={onSetMastery} disabled={disabled} />

        {open && (
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-4 flex-wrap text-[11px] text-gray-400 dark:text-gray-500">
            {item.topic && <span>{item.topic}</span>}
            {item.lastPracticedAt && <span>Last {formatRelative(item.lastPracticedAt)}</span>}
            {item.repeatCount > 0 && <span>{item.repeatCount}× reviewed</span>}
            {item.totalTimeSeconds > 0 && <span>{formatDuration(item.totalTimeSeconds)} spent</span>}
            {actions}
            {onRemove && (
              <button
                type="button"
                onClick={onRemove}
                className="ml-auto text-gray-300 dark:text-gray-700 hover:text-red-500 transition-colors"
              >
                Remove
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function PageButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      {children}
    </button>
  );
}

/** 1 … 4 5 6 … 30 — always shows first, last and a window around current. */
function buildPagination(current: number, total: number): Array<number | "…"> {
  const pages = Array.from({ length: total }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === total || Math.abs(p - current) <= 1
  );

  return pages.reduce<Array<number | "…">>((acc, page, index, arr) => {
    if (index > 0 && page - arr[index - 1] > 1) acc.push("…");
    acc.push(page);
    return acc;
  }, []);
}
