"use client";
import { cn } from "@/lib/cn";

/**
 * The two review actions, shared by the DSA track and collections.
 *
 * Kept deliberately dumb — it takes booleans and callbacks, never a record — so
 * the same component serves `ProblemWithProgress` and `ItemWithProgress`
 * without either page knowing about the other's shape.
 */
export function ReviewControls({
  due,
  flagged,
  revisionCount,
  onRevise,
  onToggleFlag,
  disabled,
  size = "sm",
}: {
  due: boolean;
  /** Due because the user asked, rather than because the schedule said so. */
  flagged: boolean;
  revisionCount: number;
  onRevise: () => void;
  onToggleFlag: (next: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const pad = size === "md" ? "px-3 py-1.5 text-xs" : "px-2 py-1 text-[11px]";

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Only offered when there is something to clear. Marking a not-due item
          as revised would silently push its next review further out, which is
          not what the button appears to do. */}
      {due && (
        <button
          type="button"
          onClick={onRevise}
          disabled={disabled}
          title="Reviewed my notes — clear this without re-solving"
          className={cn(
            "font-semibold rounded-lg border transition-colors disabled:opacity-50",
            "border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300",
            "hover:bg-amber-50 dark:hover:bg-amber-950/40",
            pad
          )}
        >
          ✓ Revised
        </button>
      )}

      <button
        type="button"
        onClick={() => onToggleFlag(!flagged)}
        disabled={disabled}
        aria-pressed={flagged}
        title={flagged ? "Remove from the review queue" : "Show this to me again"}
        className={cn(
          "font-medium rounded-lg border transition-colors disabled:opacity-50",
          flagged
            ? "bg-purple-600 border-purple-600 text-white hover:bg-purple-700"
            : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-purple-300 hover:text-purple-600",
          pad
        )}
      >
        {flagged ? "★ Flagged" : "☆ Review again"}
      </button>

      {revisionCount > 0 && (
        <span className="text-[10px] text-gray-400 dark:text-gray-600 tabular-nums">
          {revisionCount}× revised
        </span>
      )}
    </div>
  );
}

/**
 * Badge distinguishing *why* an item is due.
 *
 * A schedule-driven review and one you asked for yourself warrant different
 * responses, so they should not look identical in a list.
 */
export function DueBadge({ due, flagged }: { due: boolean; flagged: boolean }) {
  if (!due) return null;
  return flagged ? (
    <span className="text-[10px] font-semibold text-purple-500 shrink-0" title="You flagged this">
      ★ flagged
    </span>
  ) : (
    <span className="text-[10px] font-semibold text-red-500 shrink-0">🔴 due</span>
  );
}
