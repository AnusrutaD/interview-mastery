"use client";
import { useEffect, useState } from "react";
import {
  PERIOD_LABELS,
  TARGET_PERIODS,
  TARGET_UNITS,
  describeTarget,
  type Target,
  type TargetPeriod,
  type TargetProgress,
  type TargetUnit,
} from "@/core/domain/target";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { cn } from "@/lib/cn";

/**
 * Presets, not a free number field.
 *
 * The value that makes sense depends entirely on the period and unit — "3" is a
 * reasonable day of problems and an absurd month of minutes. Offering the right
 * handful per combination is faster than typing and makes a nonsense target
 * hard to set by accident. "Custom" is still there for anyone who wants it.
 */
const PRESETS: Record<TargetUnit, Record<TargetPeriod, number[]>> = {
  count: {
    daily: [1, 2, 3, 5, 10],
    weekly: [5, 10, 15, 20, 30],
    monthly: [20, 40, 60, 80, 100],
  },
  minutes: {
    daily: [15, 30, 45, 60, 90],
    weekly: [120, 180, 300, 420, 600],
    monthly: [600, 900, 1200, 1800, 2400],
  },
};

const UNIT_LABELS: Record<TargetUnit, string> = { count: "Items", minutes: "Minutes" };

/** 90 → "90 min", 420 → "7 hr", 90 count → "90". */
function formatValue(value: number, unit: TargetUnit): string {
  if (unit === "count") return String(value);
  if (value < 60) return `${value} min`;
  const hours = value / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hr`;
}

export function TargetEditor({
  target,
  progress,
  suggestMinutes,
  onSave,
  saving,
}: {
  target: Target | null;
  progress: TargetProgress | null;
  /**
   * Whether this list is mostly timed content. Only nudges the *default* unit
   * for a new target — never overrides a choice the user already made.
   */
  suggestMinutes?: boolean;
  onSave: (target: Target | null) => void | Promise<void>;
  saving?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [period, setPeriod] = useState<TargetPeriod>(target?.period ?? "daily");
  const [unit, setUnit] = useState<TargetUnit>(
    target?.unit ?? (suggestMinutes ? "minutes" : "count")
  );

  // Re-seed the draft whenever the editor opens, so cancelling and reopening
  // shows the saved target rather than the abandoned edit.
  useEffect(() => {
    if (!editing) return;
    setPeriod(target?.period ?? "daily");
    setUnit(target?.unit ?? (suggestMinutes ? "minutes" : "count"));
  }, [editing, target, suggestMinutes]);

  const commit = async (value: number | null) => {
    await onSave(value === null ? null : { period, unit, value });
    setEditing(false);
  };

  if (!editing) {
    return (
      <div className="flex items-center gap-3 flex-wrap">
        {progress ? (
          <>
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs",
                progress.met
                  ? "bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300"
                  : "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
              )}
            >
              <span aria-hidden>{progress.met ? "🎉" : "🎯"}</span>
              <span className="font-semibold tabular-nums">{describeTarget(progress)}</span>
            </div>
            {!progress.met && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {progress.remaining}
                {progress.target.unit === "minutes" ? " min" : ""} to go
              </span>
            )}
          </>
        ) : (
          <span className="text-xs text-gray-400 dark:text-gray-600">No target set</span>
        )}

        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          {target ? "Change target" : "Set a target"}
        </button>
      </div>
    );
  }

  const presets = PRESETS[unit][period];

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Segmented
          label="Period"
          options={TARGET_PERIODS.map((p) => ({ value: p, label: PERIOD_LABELS[p] }))}
          value={period}
          onChange={setPeriod}
        />
        <Segmented
          label="Measure"
          options={TARGET_UNITS.map((u) => ({ value: u, label: UNIT_LABELS[u] }))}
          value={unit}
          onChange={setUnit}
        />
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {presets.map((value) => (
          <button
            key={value}
            type="button"
            disabled={saving}
            onClick={() => void commit(value)}
            className={cn(
              "text-xs px-2.5 h-8 rounded-lg border font-medium transition-colors disabled:opacity-50",
              target?.value === value && target.period === period && target.unit === unit
                ? "bg-blue-600 border-blue-600 text-white"
                : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-blue-400"
            )}
          >
            {formatValue(value, unit)}
          </button>
        ))}
        <CustomValue unit={unit} disabled={saving} onCommit={(v) => void commit(v)} />
      </div>

      {/* Minutes counts finished runtime, not stopwatch time. Saying so here
          stops the number from looking wrong to anyone who checks it. */}
      {unit === "minutes" && (
        <p className="text-[11px] text-gray-400 dark:text-gray-500">
          Counts the runtime of items you finish {PERIOD_LABELS[period]} — a 20-minute video
          counts once you complete it.
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => void commit(null)}
          className="text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 transition-colors disabled:opacity-50"
        >
          Remove target
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors ml-auto"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function CustomValue({
  unit,
  disabled,
  onCommit,
}: {
  unit: TargetUnit;
  disabled?: boolean;
  onCommit: (value: number) => void;
}) {
  const [raw, setRaw] = useState("");
  const parsed = Number.parseInt(raw, 10);
  const valid = Number.isFinite(parsed) && parsed > 0 && parsed <= 10_000;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid) return;
        onCommit(parsed);
        setRaw("");
      }}
      className="flex items-center gap-1"
    >
      <input
        type="number"
        min={1}
        max={10_000}
        value={raw}
        onChange={(event) => setRaw(event.target.value)}
        placeholder={unit === "minutes" ? "min" : "n"}
        aria-label={`Custom ${unit} target`}
        className="w-16 text-xs h-8 px-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-600"
      />
      {valid && (
        <button
          type="submit"
          disabled={disabled}
          className="text-xs h-8 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors disabled:opacity-50"
        >
          Set
        </button>
      )}
    </form>
  );
}

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex items-center border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden text-xs font-medium"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "px-2.5 py-1.5 capitalize transition-colors",
            value === option.value
              ? "bg-blue-600 text-white"
              : "bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Shows how far through the period the target is, if there is one. */
export function TargetBar({ progress }: { progress: TargetProgress | null }) {
  if (!progress) return null;
  return (
    <ProgressBar
      value={progress.percent}
      max={100}
      height="h-1.5"
      className="mt-2"
      barClassName={progress.met ? "bg-green-500" : "bg-blue-500"}
    />
  );
}
