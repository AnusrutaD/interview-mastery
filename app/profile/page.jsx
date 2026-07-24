"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const DIFF_COLOR = {
  Easy:   { text: "text-green-600",  bg: "bg-green-500" },
  Medium: { text: "text-yellow-600", bg: "bg-yellow-500" },
  Hard:   { text: "text-red-600",    bg: "bg-red-500" },
};

const MASTERY_COLOR = {
  mastered: { text: "text-green-700",  bg: "bg-green-100",  label: "Mastered" },
  familiar: { text: "text-blue-700",   bg: "bg-blue-100",   label: "Familiar" },
  learning: { text: "text-yellow-700", bg: "bg-yellow-100", label: "Learning" },
  unseen:   { text: "text-gray-500",   bg: "bg-gray-100",   label: "Unseen"   },
};

function Avatar({ user }) {
  if (user?.image) {
    return <img src={user.image} alt={user.name} className="w-20 h-20 rounded-full border-4 border-white shadow-md" />;
  }
  const initials = (user?.name || user?.email || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="w-20 h-20 rounded-full border-4 border-white shadow-md bg-blue-600 flex items-center justify-center text-white text-2xl font-bold">
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
        <circle cx="60" cy="60" r={r} fill="none" stroke="#e5e7eb" strokeWidth="10" />
        <circle
          cx="60" cy="60" r={r} fill="none"
          stroke="#2563eb" strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="text-center z-10">
        <p className="text-3xl font-bold text-gray-900">{solved}</p>
        <p className="text-xs text-gray-400">/ {total}</p>
      </div>
    </div>
  );
}

function Bar({ value, total, colorClass }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
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
  }, [status]);

  const copyApiKey = () => {
    navigator.clipboard.writeText(apiKey);
    setApiKeyCopied(true);
    setTimeout(() => setApiKeyCopied(false), 2000);
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm animate-pulse">Loading profile…</div>
      </div>
    );
  }

  if (!data) return null;
  const { user, stats, byDifficulty, byCategory, recent } = data;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-6">

        {/* Back */}
        <Link href="/" className="text-sm text-blue-600 hover:underline mb-4 inline-block">← Back to dashboard</Link>

        {/* Hero card */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-4 flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <Avatar user={user} />
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-2xl font-bold text-gray-900">{user.name || "Anonymous"}</h1>
            <p className="text-sm text-gray-400 mt-0.5">{user.email}</p>
            <div className="flex flex-wrap gap-2 justify-center sm:justify-start mt-3">
              <span className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium">NeetCode 150</span>
              <span className="text-xs bg-green-50 text-green-700 px-3 py-1 rounded-full font-medium">
                {Math.round((stats.solved / stats.total) * 100)}% Complete
              </span>
              {stats.mastered > 0 && (
                <span className="text-xs bg-purple-50 text-purple-700 px-3 py-1 rounded-full font-medium">
                  {stats.mastered} Mastered
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Progress overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">

          {/* Circle + mastery breakdown */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Overall Progress</h2>
            <div className="flex items-center gap-6">
              <CircleProgress solved={stats.solved} total={stats.total} />
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
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">By Difficulty</h2>
            <div className="flex flex-col gap-4">
              {byDifficulty.map(d => {
                const cfg = DIFF_COLOR[d.label];
                return (
                  <div key={d.label}>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className={`text-xs font-semibold ${cfg.text}`}>{d.label}</span>
                      <span className="text-xs text-gray-500">{d.solved} / {d.total}</span>
                    </div>
                    <Bar value={d.solved} total={d.total} colorClass={cfg.bg} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Category breakdown */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">By Topic</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
            {byCategory.map(cat => (
              <div key={cat.name}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-gray-600 truncate mr-2">{cat.name}</span>
                  <span className="text-xs text-gray-400 shrink-0">{cat.solved}/{cat.total}</span>
                </div>
                <Bar value={cat.solved} total={cat.total} colorClass="bg-blue-500" />
              </div>
            ))}
          </div>
        </div>

        {/* API Key — Chrome Extension */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 mb-4">
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
          <p className="text-xs text-amber-600 dark:text-amber-500 mt-2">⚠ Keep this key private. Regenerating will invalidate the old key.</p>
        </div>

        {/* Recent activity */}
        {recent.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Recent Activity</h2>
            <div className="flex flex-col gap-2">
              {recent.map(p => {
                const diff = DIFF_COLOR[p.difficulty];
                const mst = MASTERY_COLOR[p.mastery];
                return (
                  <div key={p.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                    <span className="text-xs text-gray-300 w-6 text-right shrink-0">{p.id}</span>
                    <span className="text-sm text-gray-700 flex-1 truncate">{p.title}</span>
                    <span className={`text-xs font-medium ${diff.text} hidden sm:block`}>{p.difficulty}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${mst.bg} ${mst.text} font-medium shrink-0`}>
                      {mst.label}
                    </span>
                    <span className="text-xs text-gray-300 shrink-0">{timeAgo(p.updatedAt)}</span>
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
