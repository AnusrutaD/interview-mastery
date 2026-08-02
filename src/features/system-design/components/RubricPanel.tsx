"use client";
import { useMemo, useState } from "react";
import {
  RUBRIC_BANDS,
  scoreRubric,
  type RubricSection,
} from "@/core/domain/rubric";
import { Card, CardHeader } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { cn } from "@/lib/cn";

interface RubricPanelProps {
  sections: readonly RubricSection[];
  initialChecked: readonly string[];
  savedScore: number | null;
  savedMax: number | null;
  disabled?: boolean;
  saving?: boolean;
  onSubmit: (checked: string[]) => Promise<void>;
}

const BAND_STYLES: Record<string, string> = {
  "needs-work": "text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800",
  developing: "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800",
  solid: "text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800",
  strong: "text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800",
};

/**
 * Self-assessment against the exercise rubric.
 *
 * The scoring is live as you tick, which is intentional: watching the score
 * move makes the weighting visible, and the unchecked items double as the
 * study list for the next attempt.
 */
export function RubricPanel({
  sections,
  initialChecked,
  savedScore,
  savedMax,
  disabled,
  saving,
  onSubmit,
}: RubricPanelProps) {
  const [checked, setChecked] = useState<Set<string>>(new Set(initialChecked));
  const [submitted, setSubmitted] = useState(false);

  const result = useMemo(() => scoreRubric(sections, [...checked]), [sections, checked]);

  if (sections.length === 0) return null;

  const toggle = (id: string) => {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSubmitted(false);
  };

  const handleSubmit = async () => {
    await onSubmit([...checked]);
    setSubmitted(true);
  };

  return (
    <Card padded={false} className="p-6">
      <CardHeader
        title="Score your design"
        action={
          savedScore !== null && savedMax ? (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Last: {savedScore}/{savedMax}
            </span>
          ) : null
        }
        className="mb-1"
      />
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
        Write your design first, then tick only what you actually covered. Be strict — the
        unchecked boxes are your study list.
      </p>

      <div
        className={cn(
          "flex items-center gap-3 mb-5 px-4 py-3 rounded-xl border",
          BAND_STYLES[result.band]
        )}
      >
        <div className="flex-1">
          <p className="text-sm font-bold">
            {result.score} / {result.max} · {RUBRIC_BANDS[result.band].label}
          </p>
          <ProgressBar
            value={result.score}
            max={result.max}
            height="h-1.5"
            className="mt-1.5 bg-white/50 dark:bg-black/20"
            barClassName="bg-current opacity-70"
          />
        </div>
        <span className="text-2xl font-bold tabular-nums shrink-0">{result.percent}%</span>
      </div>

      <div className="flex flex-col gap-5">
        {sections.map((section) => (
          <fieldset key={section.title}>
            <legend className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              {section.title}
            </legend>
            <div className="flex flex-col gap-1.5">
              {section.criteria.map((criterion) => {
                const isChecked = checked.has(criterion.id);
                const weight = criterion.weight ?? 1;

                return (
                  <label
                    key={criterion.id}
                    className={cn(
                      "flex gap-2.5 items-start px-3 py-2 rounded-lg border cursor-pointer transition-colors",
                      isChecked
                        ? "border-green-300 dark:border-green-700 bg-green-50/60 dark:bg-green-950/30"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={disabled}
                      onChange={() => toggle(criterion.id)}
                      className="mt-0.5 accent-green-600 shrink-0"
                    />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-gray-700 dark:text-gray-300">
                        {criterion.label}
                        {weight > 1 && (
                          <span className="ml-1.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                            ×{weight}
                          </span>
                        )}
                      </span>
                      {criterion.hint && (
                        <span className="block text-xs text-gray-400 dark:text-gray-600 mt-0.5 leading-relaxed">
                          {criterion.hint}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-5">
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={disabled || saving}
          className="text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-5 py-2 rounded-lg transition-colors"
        >
          {saving ? "Saving…" : "Save assessment"}
        </button>
        {submitted && !saving && (
          <span className="text-xs text-green-600 dark:text-green-400 font-medium">
            Saved · mastery updated
          </span>
        )}
      </div>
    </Card>
  );
}
