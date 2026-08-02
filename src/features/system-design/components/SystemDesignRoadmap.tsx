"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { isSolved, MASTERY_CONFIG } from "@/core/domain/mastery";
import { isDue } from "@/core/domain/review";
import { Card } from "@/components/ui/Card";
import { LevelBadge } from "@/components/ui/LevelBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import type { StudyItemSummary } from "@/server/content/studyContent";
import type { StudyProgressMap } from "@/server/services/study.service";
import { fetchStudyProgress } from "../api/study.client";
import { cn } from "@/lib/cn";

interface Props {
  items: StudyItemSummary[];
  patterns: { name: string; icon: string }[];
}

export function SystemDesignRoadmap({ items, patterns }: Props) {
  const { status } = useSession();
  const [progress, setProgress] = useState<StudyProgressMap>({});

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    fetchStudyProgress()
      .then((map) => !cancelled && setProgress(map))
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [status]);

  const stats = useMemo(() => {
    let studied = 0;
    let due = 0;
    for (const item of items) {
      const record = progress[item.slug];
      if (!record) continue;
      if (isSolved(record.mastery)) studied += 1;
      if (isDue(record.mastery, record.lastMasteryAt)) due += 1;
    }
    return { studied, due, total: items.length };
  }, [items, progress]);

  return (
    <>
      <div className="grid grid-cols-3 gap-2 mb-5">
        <Tile label="Studied" value={`${stats.studied}/${stats.total}`} color="text-blue-600 dark:text-blue-400" />
        <Tile label="Due for review" value={String(stats.due)} color="text-red-600 dark:text-red-400" />
        <Tile label="Patterns" value={String(patterns.length)} color="text-green-600 dark:text-green-400" />
      </div>

      <div className="flex flex-col gap-4">
        {patterns.map((pattern) => {
          const patternItems = items.filter((i) => i.pattern === pattern.name);
          const done = patternItems.filter((i) => {
            const record = progress[i.slug];
            return record ? isSolved(record.mastery) : false;
          }).length;

          return (
            <section key={pattern.name}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg" aria-hidden>
                  {pattern.icon}
                </span>
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  {pattern.name}
                </h2>
                <span className="text-[11px] text-gray-400 dark:text-gray-500">
                  {done}/{patternItems.length}
                </span>
                <div className="flex-1 max-w-24 ml-auto">
                  <ProgressBar value={done} max={patternItems.length} height="h-1" />
                </div>
              </div>

              <Card padded={false} className="overflow-hidden">
                <ul>
                  {patternItems.map((item, index) => (
                    <ItemRow
                      key={item.slug}
                      item={item}
                      record={progress[item.slug]}
                      last={index === patternItems.length - 1}
                    />
                  ))}
                </ul>
              </Card>
            </section>
          );
        })}
      </div>
    </>
  );
}

function ItemRow({
  item,
  record,
  last,
}: {
  item: StudyItemSummary;
  record: StudyProgressMap[string] | undefined;
  last: boolean;
}) {
  const mastery = record?.mastery ?? "unseen";
  const due = record ? isDue(mastery, record.lastMasteryAt) : false;
  const cfg = MASTERY_CONFIG[mastery];

  return (
    <li className={cn(!last && "border-b border-gray-100 dark:border-gray-800")}>
      <Link
        href={`/system-design/${item.slug}`}
        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <span
          className="text-base shrink-0"
          aria-hidden
          title={item.type === "concept" ? "Concept" : "Design exercise"}
        >
          {item.type === "concept" ? "📘" : "🛠"}
        </span>

        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
              {item.title}
            </span>
            <LevelBadge level={item.level} size="xs" />
            {due && (
              <span className="text-[10px] font-semibold text-red-500" title="Due for review">
                🔴 due
              </span>
            )}
          </span>
          <span className="block text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
            {item.summary}
          </span>
        </span>

        <span className="flex items-center gap-2 shrink-0">
          {record?.quizBestScore !== null && record?.quizTotal ? (
            <span className="text-[10px] text-gray-400 dark:text-gray-600 tabular-nums hidden sm:inline">
              quiz {record.quizBestScore}/{record.quizTotal}
            </span>
          ) : null}
          {record?.rubricScore !== null && record?.rubricMax ? (
            <span className="text-[10px] text-gray-400 dark:text-gray-600 tabular-nums hidden sm:inline">
              {record.rubricScore}/{record.rubricMax}
            </span>
          ) : null}
          <span className="text-[10px] text-gray-400 dark:text-gray-500">{item.minutes}m</span>
          <span
            className={cn(
              "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
              cfg.bgColor,
              cfg.textColor,
              cfg.darkBgColor,
              cfg.darkTextColor
            )}
          >
            {cfg.label}
          </span>
        </span>
      </Link>
    </li>
  );
}

function Tile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-center">
      <p className={cn("text-xl font-bold", color)}>{value}</p>
      <p className="text-[10px] text-gray-400 dark:text-gray-500">{label}</p>
    </div>
  );
}
