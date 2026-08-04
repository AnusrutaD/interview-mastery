"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { isSolved } from "@/core/domain/mastery";
import { joinProgress, summarize, suggestNext } from "@/core/domain/progress";
import { isDue } from "@/core/domain/review";
import { PROBLEMS } from "@/data/problems";
import { fetchProgress } from "@/features/progress/api/progress.client";
import { fetchStudyProgress } from "@/features/system-design/api/study.client";
import type { ProgressMap } from "@/core/domain/progress";
import type { StudyProgressMap } from "@/server/services/study.service";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { cn } from "@/lib/cn";
import { problemHref } from "@/data/catalog";

export interface TrackPickerProps {
  /** Slug + title of every system-design item, passed from the server. */
  studyItems: { slug: string; title: string }[];
}

interface TrackStats {
  attempted: number;
  total: number;
  due: number;
  percent: number;
}

const EMPTY_STATS: TrackStats = { attempted: 0, total: 0, due: 0, percent: 0 };

/**
 * Landing page: choose a track.
 *
 * The cards deliberately show live progress rather than being static entry
 * points — the most useful thing this screen can tell you is which track has
 * reviews waiting, so the choice is informed rather than arbitrary.
 */
export function TrackPicker({ studyItems }: TrackPickerProps) {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";

  const [dsa, setDsa] = useState<ProgressMap>({});
  const [study, setStudy] = useState<StudyProgressMap>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    void Promise.allSettled([fetchProgress(), fetchStudyProgress()]).then(
      ([dsaRes, studyRes]) => {
        if (cancelled) return;
        if (dsaRes.status === "fulfilled") setDsa(dsaRes.value);
        if (studyRes.status === "fulfilled") setStudy(studyRes.value);
        setLoaded(true);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const dsaStats = useMemo<TrackStats>(() => {
    const joined = joinProgress(PROBLEMS, dsa);
    const s = summarize(joined);
    return {
      attempted: s.attempted,
      total: s.total,
      due: s.due,
      percent: s.completionPercent,
    };
  }, [dsa]);

  const nextProblem = useMemo(() => suggestNext(joinProgress(PROBLEMS, dsa)), [dsa]);

  const sdStats = useMemo<TrackStats>(() => {
    if (studyItems.length === 0) return EMPTY_STATS;
    let attempted = 0;
    let due = 0;
    for (const item of studyItems) {
      const record = study[item.slug];
      if (!record) continue;
      if (isSolved(record.mastery)) attempted += 1;
      if (isDue(record.mastery, record.lastMasteryAt)) due += 1;
    }
    return {
      attempted,
      total: studyItems.length,
      due,
      percent: Math.round((attempted / studyItems.length) * 100),
    };
  }, [study, studyItems]);

  const nextStudy = useMemo(
    () => studyItems.find((item) => !study[item.slug] || !isSolved(study[item.slug].mastery)),
    [study, studyItems]
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-3xl mx-auto px-4 py-10 sm:py-16">
        <header className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            What are you preparing today?
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Pick a track. Your progress and review schedule are tracked separately for each.
          </p>
        </header>

        <div className="grid sm:grid-cols-2 gap-4">
          <TrackCard
            href="/dsa"
            icon="⚡"
            title="DSA"
            subtitle="NeetCode 150"
            description="Pattern-based coding practice with spaced repetition and a solve timer."
            accent="blue"
            stats={dsaStats}
            loaded={loaded && isAuthenticated}
            continueLabel={nextProblem?.title}
            continueHref={nextProblem ? (problemHref(nextProblem.id) ?? undefined) : undefined}
          />

          <TrackCard
            href="/system-design"
            icon="🏗"
            title="System Design"
            subtitle="Concepts & exercises"
            description="Read a concept, check it with a quiz, then design and score yourself against a rubric."
            accent="violet"
            stats={sdStats}
            loaded={loaded && isAuthenticated}
            continueLabel={nextStudy?.title}
            continueHref={nextStudy ? `/system-design/${nextStudy.slug}` : undefined}
          />
        </div>

        {/* Bring-your-own lists. Deliberately last: the built-in tracks are the
            fastest way in, but this is where the product is heading. */}
        <Link href="/collections" className="block group mt-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 group-hover:border-emerald-400 dark:group-hover:border-emerald-500 transition-colors flex items-center gap-4">
            <span className="text-2xl shrink-0" aria-hidden>📚</span>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">My Lists</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                Bring your own problem set or playlist — paste links from anywhere and track them
                the same way.
              </p>
            </div>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
              Open →
            </span>
          </div>
        </Link>

        {!isAuthenticated && status !== "loading" && (
          <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-6">
            <Link href="/login" className="text-blue-600 dark:text-blue-400 hover:underline">
              Sign in
            </Link>{" "}
            to save your progress across devices.
          </p>
        )}

        <div className="flex items-center justify-center gap-5 mt-10 text-xs">
          <Link
            href="/activity"
            className="text-gray-400 dark:text-gray-500 hover:text-blue-500 transition-colors"
          >
            Activity history
          </Link>
          <Link
            href="/profile"
            className="text-gray-400 dark:text-gray-500 hover:text-blue-500 transition-colors"
          >
            Profile & settings
          </Link>
        </div>
      </div>
    </div>
  );
}

const ACCENTS = {
  blue: {
    ring: "hover:border-blue-400 dark:hover:border-blue-500",
    glow: "group-hover:bg-blue-50 dark:group-hover:bg-blue-950/30",
    bar: "bg-blue-500",
    button: "bg-blue-600 hover:bg-blue-700",
    text: "text-blue-600 dark:text-blue-400",
  },
  violet: {
    ring: "hover:border-violet-400 dark:hover:border-violet-500",
    glow: "group-hover:bg-violet-50 dark:group-hover:bg-violet-950/30",
    bar: "bg-violet-500",
    button: "bg-violet-600 hover:bg-violet-700",
    text: "text-violet-600 dark:text-violet-400",
  },
} as const;

function TrackCard({
  href,
  icon,
  title,
  subtitle,
  description,
  accent,
  stats,
  loaded,
  continueLabel,
  continueHref,
}: {
  href: string;
  icon: string;
  title: string;
  subtitle: string;
  description: string;
  accent: keyof typeof ACCENTS;
  stats: TrackStats;
  loaded: boolean;
  continueLabel?: string;
  continueHref?: string;
}) {
  const theme = ACCENTS[accent];

  return (
    <div
      className={cn(
        "group relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700",
        "rounded-2xl p-6 transition-colors flex flex-col",
        theme.ring
      )}
    >
      {/* Whole card is clickable; the inner Continue link sits above it. */}
      <Link href={href} className="absolute inset-0 rounded-2xl" aria-label={`Open ${title}`}>
        <span className="sr-only">{title}</span>
      </Link>

      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <span className="text-3xl block mb-2" aria-hidden>
            {icon}
          </span>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{title}</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500">{subtitle}</p>
        </div>

        {loaded && stats.due > 0 && (
          <span className="text-[10px] font-semibold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-2 py-1 rounded-full shrink-0">
            {stats.due} due
          </span>
        )}
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-4 flex-1">
        {description}
      </p>

      {loaded ? (
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-gray-500 dark:text-gray-400">
              {stats.attempted} / {stats.total}
            </span>
            <span className={cn("font-semibold", theme.text)}>{stats.percent}%</span>
          </div>
          <ProgressBar
            value={stats.attempted}
            max={stats.total}
            barClassName={theme.bar}
            height="h-1.5"
          />
        </div>
      ) : (
        <div className="h-9 mb-4" aria-hidden />
      )}

      <div className="relative flex items-center gap-2">
        <Link
          href={href}
          className={cn(
            "text-xs font-semibold text-white px-4 py-2 rounded-lg transition-colors",
            theme.button
          )}
        >
          {stats.attempted > 0 ? "Continue →" : "Start →"}
        </Link>

        {continueHref && continueLabel && (
          <Link
            href={continueHref}
            title={continueLabel}
            className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors truncate min-w-0"
          >
            Next: {continueLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
