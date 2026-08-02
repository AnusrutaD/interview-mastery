"use client";
import { useState } from "react";
import Link from "next/link";
import type { QuizQuestion } from "@/core/domain/quiz";
import type { RubricSection } from "@/core/domain/rubric";
import type { SDLevel, StudyItemType } from "@/core/domain/systemDesign";
import { patternIcon } from "@/core/domain/systemDesign";
import { formatClock, formatDuration } from "@/core/time/format";
import { Card } from "@/components/ui/Card";
import { LevelBadge } from "@/components/ui/LevelBadge";
import { Markdown } from "@/components/ui/Markdown";
import { MarkdownNote } from "@/features/notes/components/MarkdownNote";
import { MasterySelector } from "@/features/problems/components/MasterySelector";
import { useStudyItem } from "../hooks/useStudyItem";
import { QuizPanel } from "./QuizPanel";
import { RubricPanel } from "./RubricPanel";
import { cn } from "@/lib/cn";

export interface StudyItemPayload {
  slug: string;
  type: StudyItemType;
  title: string;
  pattern: string;
  level: SDLevel;
  summary: string;
  minutes: number;
  body: string;
  quiz: QuizQuestion[];
  rubric: RubricSection[];
  solution: string | null;
}

interface Props {
  item: StudyItemPayload;
  neighbours: {
    previous: { slug: string; title: string } | null;
    next: { slug: string; title: string } | null;
  };
}

export function StudyItemView({ item, neighbours }: Props) {
  const session = useStudyItem(item.type, item.slug);
  const { record, saving, error, isAuthenticated, due, reviewStatus, timer, hasAttempted } =
    session;

  const [showSolution, setShowSolution] = useState(false);
  const isExercise = item.type === "exercise";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <nav className="text-xs text-gray-400 dark:text-gray-500 mb-3 flex items-center gap-1.5">
          <Link href="/" className="hover:text-blue-500 transition-colors">
            Dashboard
          </Link>
          <span>/</span>
          <Link href="/system-design" className="hover:text-blue-500 transition-colors">
            System Design
          </Link>
          <span>/</span>
          <span className="text-gray-600 dark:text-gray-300 truncate">{item.title}</span>
        </nav>

        {error && (
          <div
            role="alert"
            className="mb-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl px-4 py-2.5 text-xs text-red-700 dark:text-red-400"
          >
            {error}
          </div>
        )}

        <Card className="mb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span aria-hidden>{patternIcon(item.pattern)}</span>
                <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">
                  {item.pattern}
                </span>
                <LevelBadge level={item.level} />
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {isExercise ? "🛠 Exercise" : "📘 Concept"} · {item.minutes}m
                </span>
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{item.title}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{item.summary}</p>
            </div>

            {reviewStatus && (
              <div
                className={cn(
                  "shrink-0 text-center px-3 py-2 rounded-xl border",
                  due
                    ? "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800"
                    : "bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800"
                )}
              >
                <p
                  className={cn(
                    "text-xs font-semibold",
                    due ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
                  )}
                >
                  {due ? "🔴 " : "✅ "}
                  {reviewStatus}
                </p>
              </div>
            )}
          </div>

          {/* Exercises are timed like the real thing; concepts are not a race. */}
          {isExercise && (
            <div className="flex items-center gap-3 mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex-wrap">
              <span
                className={cn(
                  "w-2 h-2 rounded-full",
                  timer.running ? "bg-green-500 animate-pulse" : "bg-gray-300 dark:bg-gray-600"
                )}
                aria-hidden
              />
              <div>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide font-medium">
                  {timer.running ? "In progress" : "Paused"}
                </p>
                <p className="text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100 leading-tight">
                  {formatClock(timer.elapsed)}
                </p>
              </div>
              <button
                type="button"
                onClick={timer.toggle}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                {timer.running ? "⏸ Pause" : "▶ Resume"}
              </button>
              <button
                type="button"
                onClick={timer.reset}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                ↺ Reset
              </button>
              <p className="text-[11px] text-gray-400 dark:text-gray-600 ml-auto">
                Target {item.minutes}m
                {record.totalTimeSeconds > 0 && ` · total ${formatDuration(record.totalTimeSeconds)}`}
              </p>
            </div>
          )}
        </Card>

        <Card className="mb-4">
          <Markdown>{item.body}</Markdown>
        </Card>

        {item.quiz.length > 0 && (
          <div className="mb-4">
            <QuizPanel
              questions={item.quiz}
              bestScore={record.quizBestScore}
              attempts={record.quizAttempts}
              disabled={!isAuthenticated}
              onSubmit={(answers) => session.submitQuiz(item.quiz, answers)}
            />
          </div>
        )}

        {isExercise && (
          <div className="mb-4">
            <MarkdownNote
              value={record.notes ?? ""}
              onSave={(next) => session.setNotes(next)}
              saving={saving}
              disabled={!isAuthenticated}
            />
          </div>
        )}

        {item.rubric.length > 0 && (
          <div className="mb-4">
            <RubricPanel
              sections={item.rubric}
              initialChecked={record.rubricChecked}
              savedScore={record.rubricScore}
              savedMax={record.rubricMax}
              disabled={!isAuthenticated}
              saving={saving}
              onSubmit={(checked) => session.submitRubric(item.rubric, checked)}
            />
          </div>
        )}

        {item.solution && (
          <Card padded={false} className="mb-4 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowSolution((v) => !v)}
              className="w-full flex items-center justify-between px-6 py-4 text-left"
              aria-expanded={showSolution}
            >
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                📋 Reference Solution
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {showSolution ? "▲ Hide" : "▼ Show"}
              </span>
            </button>

            {showSolution && (
              <div className="px-6 pb-6 border-t border-gray-100 dark:border-gray-800 pt-4">
                {/* Nudge, not a lock: reading the answer before attempting is
                    the single most effective way to learn nothing. */}
                {!hasAttempted && (
                  <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 mb-4">
                    You haven&apos;t attempted this yet. Write your own design first — reading
                    the answer now will feel productive and teach you very little.
                  </p>
                )}
                <Markdown>{item.solution}</Markdown>
              </div>
            )}
          </Card>
        )}

        <Card className="mb-4">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            How well do you know this?
          </p>
          <MasterySelector
            value={record.mastery}
            onChange={(level) => void session.setMastery(level)}
            disabled={!isAuthenticated}
            size="md"
          />
          {record.repeatCount > 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
              Reviewed {record.repeatCount}×
            </p>
          )}
        </Card>

        <nav className="grid grid-cols-2 gap-3">
          <NeighbourLink item={neighbours.previous} direction="previous" />
          <NeighbourLink item={neighbours.next} direction="next" />
        </nav>
      </div>
    </div>
  );
}

function NeighbourLink({
  item,
  direction,
}: {
  item: { slug: string; title: string } | null;
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
          {isPrevious ? "Start of course" : "End of course"}
        </span>
      </div>
    );
  }

  return (
    <Link
      href={`/system-design/${item.slug}`}
      className={cn(
        "group border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3",
        "bg-white dark:bg-gray-900 hover:border-blue-300 dark:hover:border-blue-600 transition-colors",
        !isPrevious && "text-right"
      )}
    >
      <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">
        {isPrevious ? "← Previous" : "Next →"}
      </p>
      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
        {item.title}
      </p>
    </Link>
  );
}
