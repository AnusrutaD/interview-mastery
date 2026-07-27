"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { getISTMidnight } from "@/lib/timezone";

const DIFF_COLOR = {
  Easy:   { text: "text-green-600 dark:text-green-400",  bg: "bg-green-500" },
  Medium: { text: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-500" },
  Hard:   { text: "text-red-600 dark:text-red-400",    bg: "bg-red-500" },
};

const MASTERY_COLOR = {
  mastered: { text: "text-green-700 dark:text-green-400",  bg: "bg-green-100 dark:bg-green-900/40",  label: "Mastered" },
  familiar: { text: "text-blue-700 dark:text-blue-400",    bg: "bg-blue-100 dark:bg-blue-900/40",    label: "Familiar" },
  learning: { text: "text-yellow-700 dark:text-yellow-400", bg: "bg-yellow-100 dark:bg-yellow-900/40", label: "Learning" },
  unseen:   { text: "text-gray-500 dark:text-gray-400",    bg: "bg-gray-100 dark:bg-gray-800",       label: "Unseen"   },
};

// Shared card class
const card = "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl";

function Avatar({ user }) {
  if (user?.image) {
    return <img src={user.image} alt={user.name} className="w-20 h-20 rounded-full border-4 border-white dark:border-gray-800 shadow-md" />;
  }
  const initials = (user?.name || user?.email || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="w-20 h-20 rounded-full border-4 border-white dark:border-gray-800 shadow-md bg-blue-600 flex items-center justify-center text-white text-2xl font-bold">
      {initials}
    </div>
  );
}

function CircleProgress({ solved, total }) {
  const pct = total ? solved / total : 0;
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  return (
    <div className="relative w-36 h-36 flex items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" className="stroke-gray-200 dark:stroke-gray-700" strokeWidth="10" />
        <circle
          cx="60" cy="60" r={r} fill="none"
          stroke="#2563eb" strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="text-center z-10">
        <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{solved}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">/ {total}</p>
      </div>
    </div>
  );
}

function Bar({ value, total, colorClass }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${colorClass}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function timeAgo(date) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState(null);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [dailyGoal, setDailyGoal] = useState(3);
  const [savingGoal, setSavingGoal] = useState(false);
  const [solvedTodayClient, setSolvedTodayClient] = useState(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/profile")
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
    fetch("/api/user/api-key")
      .then(r => r.json())
      .then(d => setApiKey(d.apiKey))
      .catch(console.error);
    fetch("/api/user/settings")
      .then(r => r.json())
      .then(d => setDailyGoal(d.dailyGoal ?? 3))
      .catch(console.error);
    // Compute solvedToday client-side using lastMasteryAt for correct IST timezone
    // lastMasteryAt only updates when mastery is intentionally set (not notes)
    fetch("/api/progress")
      .then(r => r.json())
      .then(({ progress, lastMasteryAt }) => {
        const todayStart = getISTMidnight();
        const count = Object.entries(lastMasteryAt || {}).filter(([id, lm]) =>
          progress?.[id] && progress[id] !== "unseen" && new Date(lm) >= todayStart
        ).length;
        setSolvedTodayClient(count);
      })
      .catch(console.error);
  }, [status]);

  const copyApiKey = () => {
    navigator.clipboard.writeText(apiKey);
    setApiKeyCopied(true);
    setTimeout(() => setApiKeyCopied(false), 2000);
  };

  const updateGoal = async (newGoal) => {
    const clamped = Math.max(1, Math.min(20, newGoal));
    setDailyGoal(clamped);
    setSavingGoal(true);
    await fetch("/api/user/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dailyGoal: clamped }),
    });
    setSavingGoal(false);
  };

  const regenerateApiKey = async () => {
    setRegenerating(true);
    const res = await fetch("/api/user/api-key", { method: "POST" });
    const d = await res.json();
    setApiKey(d.apiKey);
    setRegenerating(false);
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400 dark:text-gray-500 text-sm animate-pulse">Loading profile…</div>
      </div>
    );
  }

  if (!data) return null;
  const { user, stats, byDifficulty, byCategory, recent } = data;
  // Use client-side computed value for correct local timezone; fall back to server value while loading
  const solvedTodayDisplay = solvedTodayClient ?? stats.solvedToday;

  const statCards = [
    {
      label: "Solved Today",
      value: solvedTodayDisplay,
      icon: "🎯",
      sub: solvedTodayDisplay === 1 ? "problem" : "problems",
      color: solvedTodayDisplay > 0 ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500",
    },
    {
      label: "Current Streak",
      value: stats.streak,
      icon: stats.streak >= 7 ? "🔥" : stats.streak >= 3 ? "⚡" : "📅",
      sub: stats.streak === 1 ? "day" : "days",
      color: stats.streak >= 7 ? "text-orange-600 dark:text-orange-400" : stats.streak >= 3 ? "text-yellow-600 dark:text-yellow-400" : "text-gray-500 dark:text-gray-400",
    },
    {
      label: "Total Attempted",
      value: stats.attempted,
      icon: "✅",
      sub: `of ${stats.total}`,
      color: "text-green-700 dark:text-green-400",
    },
    {
      label: "Mastered",
      value: stats.mastered,
      icon: "⭐",
      sub: `of ${stats.total}`,
      color: "text-purple-700 dark:text-purple-400",
    },
  ];

  const solvedToday = solvedTodayDisplay;
  const goalPct = Math.min(100, Math.round((solvedToday / dailyGoal) * 100));
  const goalDone = solvedToday >= dailyGoal;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* Hero card */}
        <div className={`${card} p-6 mb-4 flex flex-col sm:flex-row items-center sm:items-start gap-5`}>
          <Avatar user={user} />
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{user.name || "Anonymous"}</h1>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{user.email}</p>
            <div className="flex flex-wrap gap-2 justify-center sm:justify-start mt-3">
              <span className="text-xs bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 px-3 py-1 rounded-full font-medium">NeetCode 150</span>
              <span className="text-xs bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 px-3 py-1 rounded-full font-medium">
                {Math.round((stats.attempted / stats.total) * 100)}% Complete
              </span>
              {stats.mastered > 0 && (
                <span className="text-xs bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-400 px-3 py-1 rounded-full font-medium">
                  {stats.mastered} Mastered
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {statCards.map(c => (
            <div key={c.label} className={`${card} p-4 flex flex-col items-center text-center`}>
              <span className="text-2xl mb-1">{c.icon}</span>
              <span className={`text-3xl font-bold ${c.color}`}>{c.value}</span>
              <span className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{c.sub}</span>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1">{c.label}</span>
            </div>
          ))}
        </div>

        {/* Daily goal card */}
        <div className={`${card} p-5 mb-4`}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Daily Goal</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {goalDone ? "🎉 Goal reached! Keep going!" : `${solvedToday} of ${dailyGoal} problems solved today`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateGoal(dailyGoal - 1)}
                disabled={dailyGoal <= 1 || savingGoal}
                className="w-7 h-7 rounded-full border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-30 transition-colors"
              >−</button>
              <span className="text-lg font-bold text-gray-800 dark:text-gray-200 w-6 text-center">{dailyGoal}</span>
              <button
                onClick={() => updateGoal(dailyGoal + 1)}
                disabled={dailyGoal >= 20 || savingGoal}
                className="w-7 h-7 rounded-full border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-30 transition-colors"
              >+</button>
            </div>
          </div>
          <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${goalDone ? "bg-green-500" : "bg-blue-500"}`}
              style={{ width: `${goalPct}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-xs text-gray-400 dark:text-gray-500">{goalPct}% complete</span>
            {goalDone && <span className="text-xs text-green-600 dark:text-green-400 font-medium">✓ Done for today</span>}
          </div>
        </div>

        {/* Progress overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">

          {/* Circle + mastery breakdown */}
          <div className={`${card} p-6`}>
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Overall Progress</h2>
            <div className="flex items-center gap-6">
              <CircleProgress solved={stats.attempted} total={stats.total} />
              <div className="flex flex-col gap-2 flex-1">
                {["mastered", "familiar", "learning", "unseen"].map(key => {
                  const cfg = MASTERY_COLOR[key];
                  return (
                    <div key={key} className="flex items-center justify-between">
                      <span className={`text-xs font-medium ${cfg.text}`}>{cfg.label}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                        {stats[key]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Difficulty breakdown */}
          <div className={`${card} p-6`}>
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">By Difficulty</h2>
            <div className="flex flex-col gap-4">
              {byDifficulty.map(d => {
                const cfg = DIFF_COLOR[d.label];
                return (
                  <div key={d.label}>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className={`text-xs font-semibold ${cfg.text}`}>{d.label}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{d.solved} / {d.total}</span>
                    </div>
                    <Bar value={d.solved} total={d.total} colorClass={cfg.bg} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Category breakdown */}
        <div className={`${card} p-6 mb-4`}>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">By Topic</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
            {byCategory.map(cat => (
              <div key={cat.name}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-gray-600 dark:text-gray-400 truncate mr-2">{cat.name}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{cat.solved}/{cat.total}</span>
                </div>
                <Bar value={cat.solved} total={cat.total} colorClass="bg-blue-500" />
              </div>
            ))}
          </div>
        </div>

        {/* API Key — Chrome Extension */}
        <div className={`${card} p-6 mb-4`}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Chrome Extension API Key</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                Paste this key into the Interview Mastery Chrome extension to auto-sync LeetCode submissions.
              </p>
            </div>
            <span className="text-xs bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-400 px-2 py-1 rounded-full font-medium shrink-0 ml-3">Extension</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 font-mono text-gray-700 dark:text-gray-300 truncate">
              {apiKey || "Generating…"}
            </code>
            <button
              onClick={copyApiKey}
              disabled={!apiKey}
              className="px-3 py-2.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shrink-0"
            >
              {apiKeyCopied ? "Copied ✓" : "Copy"}
            </button>
            <button
              onClick={regenerateApiKey}
              disabled={regenerating}
              className="px-3 py-2.5 text-xs font-medium rounded-lg border border-red-200 dark:border-red-900 bg-white dark:bg-gray-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors shrink-0"
            >
              {regenerating ? "…" : "Regenerate"}
            </button>
          </div>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">⚠ Keep this key private. Regenerating will invalidate the old key.</p>
        </div>

        {/* Recent activity */}
        {recent.length > 0 && (
          <div className={`${card} p-6`}>
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Recent Activity</h2>
            <div className="flex flex-col gap-2">
              {recent.map(p => {
                const diff = DIFF_COLOR[p.difficulty];
                const mst = MASTERY_COLOR[p.mastery];
                return (
                  <div key={p.id} className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                    <span className="text-xs text-gray-300 dark:text-gray-600 w-6 text-right shrink-0">{p.id}</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 truncate">{p.title}</span>
                    <span className={`text-xs font-medium ${diff.text} hidden sm:block`}>{p.difficulty}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${mst.bg} ${mst.text} font-medium shrink-0`}>
                      {mst.label}
                    </span>
                    <span className="text-xs text-gray-300 dark:text-gray-600 shrink-0">{timeAgo(p.updatedAt)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
