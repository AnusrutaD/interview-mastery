"use client";
import { MASTERY_CONFIG, MASTERY_LEVELS, type MasteryLevel } from "@/core/domain/mastery";
import { cn } from "@/lib/cn";

const SIZES = {
  sm: "text-[11px] px-2 py-1",
  md: "text-sm px-4 py-2",
} as const;

/**
 * The one control for changing mastery. Previously reimplemented inline in the
 * table rows, the topic page and the detail page with drifting styles.
 */
export function MasterySelector({
  value,
  onChange,
  disabled,
  size = "sm",
}: {
  value: MasteryLevel;
  onChange: (level: MasteryLevel) => void;
  disabled?: boolean;
  size?: keyof typeof SIZES;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Mastery level">
      {MASTERY_LEVELS.map((level) => {
        const cfg = MASTERY_CONFIG[level];
        const active = value === level;
        return (
          <button
            key={level}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={(event) => {
              event.stopPropagation();
              onChange(level);
            }}
            className={cn(
              "font-medium rounded-xl border-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed",
              SIZES[size],
              active
                ? cn(cfg.bgColor, cfg.textColor, cfg.darkBgColor, cfg.darkTextColor, "border-current shadow-sm")
                : "bg-white dark:bg-gray-900 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
            )}
          >
            {cfg.label}
          </button>
        );
      })}
    </div>
  );
}
