"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { MASTERY_CONFIG } from "@/core/domain/mastery";
import { patternIcon } from "@/core/domain/systemDesign";
import { formatDuration, formatRelative } from "@/core/time/format";
import { Card, CardHeader } from "@/components/ui/Card";
import { DifficultyBadge, MasteryBadge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Spinner } from "@/components/ui/Spinner";
import type { ProfilePayload, RecentEntry } from "@/server/services/profile.service";
import { get, post } from "@/lib/http";
import { cn } from "@/lib/cn";

const GOAL_MIN = 1;
const GOAL_MAX = 20;

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [dailyGoal, setDailyGoal] = useState(3);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;

    void Promise.allSettled([
      get<ProfilePayload>("/api/profile"),
      get<{ apiKey: string | null }>("/api/user/api-key"),
      get<{ dailyGoal: number }>("/api/user/settings"),
    ]).then(([profileRes, keyRes, settingsRes]) => {
      if (cancelled) return;
      if (profileRes.status === "fulfilled") setProfile(profileRes.value);
      if (keyRes.status === "fulfilled") setApiKey(keyRes.value.apiKey);
      if (settingsRes.status === "fulfilled") setDailyGoal(settingsRes.value.dailyGoal);
    });

    return () => {
      cancelled = true;
    };
  }, [status]);

  const updateGoal = useCallback(async (next: number) => {
    const clamped = Math.min(GOAL_MAX, Math.max(GOAL_MIN, next));
    setDailyGoal(clamped);
    setBusy(true);
    try {
      await post("/api/user/settings", { dailyGoal: clamped });
    } finally {
      setBusy(false);
    }
  }, []);

  const rotateKey = useCallback(async () => {
    setBusy(true);
    try {
      const { apiKey: next } = await post<{ apiKey: string }>("/api/user/api-key");
      setApiKey(next);
    } finally {
      setBusy(false);
    }
  }, []);

  const copyKey = useCallback(async () => {
    if (!apiKey) return;
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, [apiKey]);

  if (status === "loading" || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <Spinner label="Loading profile" />
      </div>
    );
  }

  const { combined, dsa, systemDesign, recent } = profile;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8">
        <Link
          href="/"
          className="text-xs text-gray-400 dark:text-gray-500 hover:text-blue-500 transition-colors"
        >
          ← Back to tracks
        </Link>

        {/* Identity + cross-track behaviour */}
        <Card className="mt-3 mb-4 flex flex-col sm:flex-row items-center gap-5">
          <Avatar
            name={session?.user?.name}
            email={session?.user?.email}
            image={session?.user?.image}
          />
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {session?.user?.name ?? "Your profile"}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{session?.user?.email}</p>
            <div className="flex gap-5 mt-3 justify-center sm:justify-start flex-wrap">
              <Metric label="Streak" value={`${combined.streak}d`} />
              <Metric label="Due today" value={String(combined.due)} />
              <Metric label="Total time" value={formatDuration(combined.totalTimeSeconds)} />
            </div>
            <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-2">
              Streak counts practice in either track
            </p>
          </div>
        </Card>

        {/* Per-track summary. Kept side by side but never merged into one number
            — 150 problems and 10 design items are not comparable units. */}
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <TrackSummary
            href="/dsa"
            icon="⚡"
            title="DSA"
            accent="blue"
            done={dsa.stats.attempted}
            total={dsa.stats.total}
            percent={dsa.stats.completionPercent}
            due={dsa.stats.due}
            today={combined.dsaSolvedToday}
            todayLabel="solved today"
            time={dsa.stats.totalTimeSeconds}
          />
          <TrackSummary
            href="/system-design"
            icon="🏗"
            title="System Design"
            accent="violet"
            done={systemDesign.studied}
            total={systemDesign.total}
            percent={systemDesign.completionPercent}
            due={systemDesign.due}
            today={combined.sdStudiedToday}
            todayLabel="studied today"
            time={systemDesign.totalTimeSeconds}
          />
        </div>

        <SectionHeading icon="⚡" title="DSA" href="/dsa" />

        <Card className="mb-4">
          <CardHeader
            title="Daily goal"
            action={
              busy ? <span className="text-xs text-blue-500 animate-pulse">Saving…</span> : null
            }
            className="mb-3"
          />
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => void updateGoal(dailyGoal - 1)}
              disabled={dailyGoal <= GOAL_MIN}
              className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              aria-label="Decrease daily goal"
            >
              −
            </button>
            <span className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums w-10 text-center">
              {dailyGoal}
            </span>
            <button
              type="button"
              onClick={() => void updateGoal(dailyGoal + 1)}
              disabled={dailyGoal >= GOAL_MAX}
              className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              aria-label="Increase daily goal"
            >
              +
            </button>
            <p className="text-xs text-gray-400 dark:text-gray-500 ml-1">
              DSA problems per day ·{" "}
              <span
                className={cn(
                  "font-semibold",
                  combined.dsaSolvedToday >= dailyGoal
                    ? "text-green-600 dark:text-green-400"
                    : "text-gray-500 dark:text-gray-400"
                )}
              >
                {combined.dsaSolvedToday}/{dailyGoal} today
              </span>
            </p>
          </div>
        </Card>

        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <Card>
            <CardHeader title="By difficulty" className="mb-3" />
            <div className="flex flex-col gap-3">
              {dsa.byDifficulty.map((row) => (
                <div key={row.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <DifficultyBadge difficulty={row.label} size="xs" />
                    <span className="text-gray-500 dark:text-gray-400">
                      {row.attempted}/{row.total}
                    </span>
                  </div>
                  <ProgressBar
                    value={row.attempted}
                    max={row.total}
                    barClassName={
                      row.label === "Easy"
                        ? "bg-green-500"
                        : row.label === "Medium"
                          ? "bg-amber-500"
                          : "bg-red-500"
                    }
                  />
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="By mastery" className="mb-3" />
            <div className="grid grid-cols-2 gap-2">
              {(["mastered", "familiar", "learning", "unsolved", "unseen"] as const).map(
                (level) => (
                  <div
                    key={level}
                    className="border border-gray-100 dark:border-gray-800 rounded-xl p-2.5 text-center"
                  >
                    <p
                      className={cn(
                        "text-xl font-bold",
                        MASTERY_CONFIG[level].textColor,
                        MASTERY_CONFIG[level].darkTextColor
                      )}
                    >
                      {dsa.stats[level]}
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">
                      {MASTERY_CONFIG[level].label}
                    </p>
                  </div>
                )
              )}
            </div>
          </Card>
        </div>

        <Card padded={false} className="overflow-hidden mb-6">
          <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Strongest topics
            </h2>
          </div>
          <ul className="p-4 grid sm:grid-cols-2 gap-x-5 gap-y-2.5">
            {dsa.byCategory.slice(0, 8).map((c) => (
              <li key={c.name}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-600 dark:text-gray-300 truncate">{c.name}</span>
                  <span className="text-gray-400 dark:text-gray-500 shrink-0 ml-2">
                    {c.attempted}/{c.total}
                  </span>
                </div>
                <ProgressBar value={c.attempted} max={c.total} height="h-1" />
              </li>
            ))}
          </ul>
        </Card>

        <SectionHeading icon="🏗" title="System Design" href="/system-design" />

        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <Card>
            <CardHeader title="Assessment scores" className="mb-3" />
            <div className="grid grid-cols-2 gap-2">
              <ScoreTile
                label="Avg quiz"
                value={
                  systemDesign.averageQuizPercent !== null
                    ? `${systemDesign.averageQuizPercent}%`
                    : "—"
                }
                sub={`${systemDesign.quizzesTaken} taken`}
                color="text-blue-600 dark:text-blue-400"
              />
              <ScoreTile
                label="Avg rubric"
                value={
                  systemDesign.averageRubricPercent !== null
                    ? `${systemDesign.averageRubricPercent}%`
                    : "—"
                }
                sub={`${systemDesign.exercisesScored} scored`}
                color="text-violet-600 dark:text-violet-400"
              />
              <ScoreTile
                label="Concepts"
                value={String(systemDesign.concepts)}
                sub="available"
                color="text-gray-700 dark:text-gray-300"
              />
              <ScoreTile
                label="Exercises"
                value={String(systemDesign.exercises)}
                sub="available"
                color="text-gray-700 dark:text-gray-300"
              />
            </div>
          </Card>

          <Card padded={false} className="overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                By pattern
              </h2>
            </div>
            <ul className="p-4 flex flex-col gap-2.5">
              {systemDesign.byPattern.map((p) => (
                <li key={p.name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600 dark:text-gray-300 truncate">
                      <span aria-hidden className="mr-1">
                        {patternIcon(p.name)}
                      </span>
                      {p.name}
                    </span>
                    <span className="text-gray-400 dark:text-gray-500 shrink-0 ml-2">
                      {p.studied}/{p.total}
                    </span>
                  </div>
                  <ProgressBar
                    value={p.studied}
                    max={p.total}
                    height="h-1"
                    barClassName="bg-violet-500"
                  />
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <SectionHeading icon="🕐" title="Recent practice" href="/activity" />

        <Card padded={false} className="overflow-hidden mb-4">
          {recent.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
              No practice recorded yet
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {recent.map((entry) => (
                <RecentRow key={`${entry.track}-${entry.href}`} entry={entry} />
              ))}
            </ul>
          )}
        </Card>

        <SectionHeading icon="🔑" title="Settings" />

        <Card>
          <CardHeader title="Chrome extension" className="mb-1" />
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
            Paste this key into the extension popup to sync LeetCode submissions automatically.
          </p>
          <div className="flex gap-2 flex-wrap">
            <code className="flex-1 min-w-0 text-xs font-mono bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 truncate text-gray-600 dark:text-gray-400">
              {apiKey ?? "No key generated yet"}
            </code>
            {apiKey && (
              <button
                type="button"
                onClick={() => void copyKey()}
                className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition-colors"
              >
                {copied ? "Copied ✓" : "Copy"}
              </button>
            )}
            <button
              type="button"
              onClick={() => void rotateKey()}
              disabled={busy}
              className="text-xs font-medium border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
            >
              {apiKey ? "Regenerate" : "Generate"}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ── Pieces ───────────────────────────────────────────────────────────────── */

function SectionHeading({ icon, title, href }: { icon: string; title: string; href?: string }) {
  return (
    <div className="flex items-center gap-2 mb-2 mt-1">
      <span aria-hidden>{icon}</span>
      <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {title}
      </h2>
      {href && (
        <Link
          href={href}
          className="ml-auto text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          Open →
        </Link>
      )}
    </div>
  );
}

const TRACK_ACCENTS = {
  blue: { bar: "bg-blue-500", text: "text-blue-600 dark:text-blue-400" },
  violet: { bar: "bg-violet-500", text: "text-violet-600 dark:text-violet-400" },
} as const;

function TrackSummary({
  href,
  icon,
  title,
  accent,
  done,
  total,
  percent,
  due,
  today,
  todayLabel,
  time,
}: {
  href: string;
  icon: string;
  title: string;
  accent: keyof typeof TRACK_ACCENTS;
  done: number;
  total: number;
  percent: number;
  due: number;
  today: number;
  todayLabel: string;
  time: number;
}) {
  const theme = TRACK_ACCENTS[accent];
  return (
    <Link href={href} className="block group">
      <Card className="h-full group-hover:border-gray-300 dark:group-hover:border-gray-600 transition-colors">
        <div className="flex items-center gap-2 mb-3">
          <span aria-hidden>{icon}</span>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{title}</h3>
          {due > 0 && (
            <span className="ml-auto text-[10px] font-semibold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-full">
              {due} due
            </span>
          )}
        </div>

        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-gray-500 dark:text-gray-400">
            {done} / {total}
          </span>
          <span className={cn("font-semibold", theme.text)}>{percent}%</span>
        </div>
        <ProgressBar value={done} max={total} barClassName={theme.bar} height="h-1.5" />

        <div className="flex gap-4 mt-3 text-[11px] text-gray-400 dark:text-gray-500">
          <span>
            <strong className="text-gray-600 dark:text-gray-300">{today}</strong> {todayLabel}
          </span>
          <span>
            <strong className="text-gray-600 dark:text-gray-300">{formatDuration(time)}</strong>{" "}
            spent
          </span>
        </div>
      </Card>
    </Link>
  );
}

function RecentRow({ entry }: { entry: RecentEntry }) {
  const isDsa = entry.track === "dsa";
  return (
    <li className="px-4 py-2.5 flex items-center gap-2">
      <span className="text-sm shrink-0" aria-hidden title={isDsa ? "DSA" : "System Design"}>
        {isDsa ? "⚡" : "🏗"}
      </span>
      <Link
        href={entry.href}
        className="flex-1 min-w-0 text-xs font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 truncate transition-colors"
      >
        {entry.title}
      </Link>
      <span className="text-[10px] text-gray-400 dark:text-gray-600 hidden sm:inline shrink-0">
        {entry.tag}
      </span>
      <MasteryBadge mastery={entry.mastery} size="xs" />
      <span className="text-[10px] text-gray-400 dark:text-gray-600 shrink-0 w-14 text-right">
        {formatRelative(entry.at)}
      </span>
    </li>
  );
}

function ScoreTile({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="border border-gray-100 dark:border-gray-800 rounded-xl p-2.5 text-center">
      <p className={cn("text-xl font-bold", color)}>{value}</p>
      <p className="text-[10px] text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-[10px] text-gray-300 dark:text-gray-700">{sub}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{value}</p>
      <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide">
        {label}
      </p>
    </div>
  );
}

function Avatar({
  name,
  email,
  image,
}: {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}) {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt=""
        className="w-20 h-20 rounded-full border-4 border-white dark:border-gray-800 shadow-md"
      />
    );
  }
  const initials = (name || email || "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      aria-hidden
      className="w-20 h-20 rounded-full border-4 border-white dark:border-gray-800 shadow-md bg-blue-600 flex items-center justify-center text-white text-2xl font-bold"
    >
      {initials}
    </div>
  );
}
