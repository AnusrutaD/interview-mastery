"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { MASTERY_CONFIG } from "@/core/domain/mastery";
import { formatDuration, formatRelative } from "@/core/time/format";
import { Card, CardHeader } from "@/components/ui/Card";
import { DifficultyBadge, MasteryBadge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Spinner } from "@/components/ui/Spinner";
import type { ProfilePayload } from "@/server/services/profile.service";
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

    // One parallel batch instead of four sequential fetches.
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

  const { stats, byDifficulty, byCategory, recent } = profile;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8">
        <Link
          href="/"
          className="text-xs text-gray-400 dark:text-gray-500 hover:text-blue-500 transition-colors"
        >
          ← Back to Dashboard
        </Link>

        <Card className="mt-3 mb-4 flex flex-col sm:flex-row items-center gap-5">
          <Avatar name={session?.user?.name} email={session?.user?.email} image={session?.user?.image} />
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {session?.user?.name ?? "Your profile"}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{session?.user?.email}</p>
            <div className="flex gap-4 mt-2 justify-center sm:justify-start">
              <Metric label="Streak" value={`${stats.streak}d`} />
              <Metric label="Today" value={String(stats.solvedToday)} />
              <Metric label="Due" value={String(stats.due)} />
              <Metric label="Time" value={formatDuration(stats.totalTimeSeconds)} />
            </div>
          </div>
          <CircleProgress value={stats.attempted} total={stats.total} />
        </Card>

        <Card className="mb-4">
          <CardHeader
            title="Daily goal"
            action={busy ? <span className="text-xs text-blue-500 animate-pulse">Saving…</span> : null}
            className="mb-3"
          />
          <div className="flex items-center gap-3">
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
            <p className="text-xs text-gray-400 dark:text-gray-500 ml-2">problems per day</p>
          </div>
        </Card>

        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <Card>
            <CardHeader title="By difficulty" className="mb-3" />
            <div className="flex flex-col gap-3">
              {byDifficulty.map((row) => (
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
              {(["mastered", "familiar", "learning", "unseen"] as const).map((level) => (
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
                    {stats[level]}
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">
                    {MASTERY_CONFIG[level].label}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card className="mb-4">
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

        <div className="grid sm:grid-cols-2 gap-4">
          <Card padded={false} className="overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Strongest topics
              </h2>
            </div>
            <ul className="p-4 flex flex-col gap-2.5">
              {byCategory.slice(0, 6).map((c) => (
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

          <Card padded={false} className="overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Recent practice
              </h2>
            </div>
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {recent.map((r) => (
                <li key={r.id} className="px-4 py-2.5 flex items-center gap-2">
                  <Link
                    href={`/problems/${r.id}`}
                    className="flex-1 min-w-0 text-xs font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 truncate transition-colors"
                  >
                    {r.title}
                  </Link>
                  <MasteryBadge mastery={r.mastery} size="xs" />
                  <span className="text-[10px] text-gray-400 dark:text-gray-600 shrink-0">
                    {formatRelative(r.lastMasteryAt)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{value}</p>
      <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide">{label}</p>
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

function CircleProgress({ value, total }: { value: number; total: number }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * (total ? value / total : 0);

  return (
    <div className="relative w-36 h-36 flex items-center justify-center shrink-0">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 120 120" aria-hidden>
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          className="stroke-gray-200 dark:stroke-gray-700"
          strokeWidth="10"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="#2563eb"
          strokeWidth="10"
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="text-center z-10">
        <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">/ {total}</p>
      </div>
    </div>
  );
}
