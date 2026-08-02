"use client";
import { useState } from "react";
import { isComplete, type QuizAnswers, type QuizQuestion, type QuizResult } from "@/core/domain/quiz";
import { Card, CardHeader } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

interface QuizPanelProps {
  questions: readonly QuizQuestion[];
  bestScore: number | null;
  attempts: number;
  disabled?: boolean;
  onSubmit: (answers: QuizAnswers) => Promise<QuizResult>;
}

export function QuizPanel({ questions, bestScore, attempts, disabled, onSubmit }: QuizPanelProps) {
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (questions.length === 0) return null;

  const ready = isComplete(questions, answers);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      setResult(await onSubmit(answers));
    } finally {
      setSubmitting(false);
    }
  };

  const retry = () => {
    setAnswers({});
    setResult(null);
  };

  return (
    <Card padded={false} className="p-6">
      <CardHeader
        title={`Check your understanding · ${questions.length} questions`}
        action={
          bestScore !== null ? (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Best {bestScore}/{questions.length} · {attempts} attempt{attempts === 1 ? "" : "s"}
            </span>
          ) : null
        }
        className="mb-4"
      />

      {result && <ResultBanner result={result} onRetry={retry} />}

      <ol className="flex flex-col gap-5">
        {questions.map((question, index) => {
          const chosen = answers[question.id];
          const revealed = result !== null;

          return (
            <li key={question.id}>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
                <span className="text-gray-400 dark:text-gray-600 mr-1.5">{index + 1}.</span>
                {question.question}
              </p>

              <div className="flex flex-col gap-1.5" role="radiogroup">
                {question.options.map((option, optionIndex) => {
                  const selected = chosen === optionIndex;
                  const isAnswer = optionIndex === question.answerIndex;

                  return (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={disabled || revealed}
                      onClick={() =>
                        setAnswers((current) => ({ ...current, [question.id]: optionIndex }))
                      }
                      className={cn(
                        "text-left text-sm px-3 py-2 rounded-lg border transition-colors",
                        revealed && isAnswer &&
                          "border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-200",
                        revealed && selected && !isAnswer &&
                          "border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200",
                        revealed && !isAnswer && !selected &&
                          "border-gray-200 dark:border-gray-800 text-gray-400 dark:text-gray-600",
                        !revealed && selected &&
                          "border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200",
                        !revealed && !selected &&
                          "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-blue-300 dark:hover:border-blue-600"
                      )}
                    >
                      <span className="font-mono text-xs text-gray-400 dark:text-gray-600 mr-2">
                        {String.fromCharCode(65 + optionIndex)}
                      </span>
                      {option}
                      {revealed && isAnswer && <span className="ml-2">✓</span>}
                    </button>
                  );
                })}
              </div>

              {/* Explanations show for every question, not just the ones missed —
                  confirming *why* a right answer was right is where the learning is. */}
              {revealed && question.explanation && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 pl-3 border-l-2 border-gray-200 dark:border-gray-700 leading-relaxed">
                  {question.explanation}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      {!result && (
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!ready || submitting || disabled}
          className="mt-5 text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg transition-colors"
        >
          {submitting ? "Checking…" : ready ? "Check answers" : `Answer all ${questions.length}`}
        </button>
      )}
    </Card>
  );
}

function ResultBanner({ result, onRetry }: { result: QuizResult; onRetry: () => void }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 mb-5 px-4 py-3 rounded-xl border",
        result.passed
          ? "bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800"
          : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800"
      )}
    >
      <span className="text-lg" aria-hidden>
        {result.passed ? "✅" : "📖"}
      </span>
      <div className="flex-1">
        <p
          className={cn(
            "text-sm font-semibold",
            result.passed
              ? "text-green-700 dark:text-green-300"
              : "text-amber-700 dark:text-amber-300"
          )}
        >
          {result.correct} / {result.total} · {result.percent}%
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {result.passed
            ? "Solid — the concept landed."
            : "Worth re-reading the sections you missed before moving on."}
        </p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="text-xs font-medium border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors shrink-0"
      >
        Retry
      </button>
    </div>
  );
}
