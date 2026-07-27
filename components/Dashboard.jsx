"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { PROBLEMS, MASTERY_ORDER, CATEGORY_ICONS, categoryToSlug } from "@/data/problems";
import StatsBar from "./StatsBar";
import Filters from "./Filters";
import ProblemTable from "./ProblemTable";
import Stopwatch from "./Stopwatch";
import { isDue } from "@/lib/spaced-repetition";

// Derive unique ordered categories from PROBLEMS
const ALL_CATEGORIES = Array.from(new Set(PROBLEMS.map(p => p.category)));

function TopicGrid({ problems }) {
  const [collapsed, setCollapsed] = useState(true);

  const stats = useMemo(() => {
    return ALL_CATEGORIES.map(cat => {
      const catProblems = problems.filter(p => p.category === cat);
      const solved = catProblems.filter(p => p.mastery !== "unseen").length;
      const due = catProblems.filter(p => p.due).length;
      const total = catProblems.length;
      const pct = total ? Math.round((solved / total) * 100) : 0;
      return { cat, solved, total, pct, due, slug: categoryToSlug(cat) };
    });
  }, [problems]);

  const SHOW = 6; // how many to show when collapsed
  const visible = collapsed ? stats.slice(0, SHOW) : stats;

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Study by Topic
        </h2>
        <Link
          href="/topics"
          className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          View all →
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
        {visible.map(({ cat, solved, total, pct, due, slug }) => (
          <Link
            key={cat}
            href={`/topics/${slug}`}
            className="group relative flex items-center gap-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 rounded-xl px-3 py-2.5 transition-colors overflow-hidden"
          >
            {/* Progress fill */}
            <div
              className="absolute inset-y-0 left-0 bg-blue-50 dark:bg-blue-950/30 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
            <span className="relative text-lg shrink-0">{CATEGORY_ICONS[cat] || "📌"}</span>
            <div className="relative flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 truncate leading-tight">
                {cat}
              </p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500">
                {solved}/{total}
                {due > 0 && (
                  <span className="ml-1.5 text-red-500 font-semibold">· {due} due</span>
                )}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {stats.length > SHOW && (
        <button
          onClick={() => setCollapsed(c => !c)}
          className="text-xs text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
        >
          {collapsed ? `Show all ${stats.length} topics ▼` : "Show less ▲"}
        </button>
      )}
    </div>
  );
}

const STORAGE_KEY = "lc-mastery-progress";
const NOTES_KEY   = "lc-mastery-notes";
const PAGE_KEY    = "lc-mastery-page";

function load(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; }
  catch { return fallback; }
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const isLoggedIn = status === "authenticated";

  const [progress,      setProgress]      = useState(() => load(STORAGE_KEY, {}));
  const [notes,         setNotes]         = useState(() => load(NOTES_KEY, {}));
  const [updatedAt,     setUpdatedAt]     = useState({});
  const [lastMasteryAt, setLastMasteryAt] = useState({});
  const [page,          setPageRaw]       = useState(1);
  const [filters,    setFilters]    = useState({ search: "", category: "All", difficulty: "All", mastery: "All", dueOnly: false });
  const [syncing,  setSyncing]  = useState(false);

  useEffect(() => {
    const saved = load(PAGE_KEY, 1);
    setPageRaw(saved);
  }, []);

  const fetchProgress = useCallback(() => {
    if (!isLoggedIn) return;
    setSyncing(true);
    fetch("/api/progress")
      .then(r => r.json())
      .then(({ progress: p, notes: n, updatedAt: u, lastMasteryAt: lm }) => {
        if (p) setProgress(p);
        if (n) setNotes(n);
        if (u) setUpdatedAt(u);
        if (lm) setLastMasteryAt(lm);
      })
      .catch(console.error)
      .finally(() => setSyncing(false));
  }, [isLoggedIn]);

  // Initial load
  useEffect(() => { fetchProgress(); }, [fetchProgress]);

  // Refetch when tab becomes visible (user switches back from LeetCode tab)
  // + poll every 30s as fallback
  useEffect(() => {
    if (!isLoggedIn) return;
    const onVisible = () => { if (document.visibilityState === "visible") fetchProgress(); };
    document.addEventListener("visibilitychange", onVisible);
    const poll = setInterval(fetchProgress, 30_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(poll);
    };
  }, [isLoggedIn, fetchProgress]);

  const setPage = (fn) => {
    setPageRaw(prev => {
      const next = typeof fn === "function" ? fn(prev) : fn;
      localStorage.setItem(PAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const problems = useMemo(() =>
    PROBLEMS.map(p => ({
      ...p,
      mastery: progress[p.id] || "unseen",
      updatedAt: updatedAt[p.id] || null,
      due: isDue(progress[p.id], updatedAt[p.id]),
    })),
    [progress, updatedAt]
  );

  const filtered = useMemo(() => {
    return problems.filter(p => {
      if (filters.category !== "All" && p.category !== filters.category) return false;
      if (filters.difficulty !== "All" && p.difficulty !== filters.difficulty) return false;
      if (filters.mastery !== "All" && p.mastery !== filters.mastery) return false;
      if (filters.dueOnly && !p.due) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (!p.title.toLowerCase().includes(q) && !String(p.leetcode).includes(q)) return false;
      }
      return true;
    });
  }, [problems, filters]);

  const handleFilterChange = (key, value) => {
    setFilters(f => ({ ...f, [key]: value }));
    setPage(1);
  };

  const setMastery = useCallback(async (id, level) => {
    setProgress(prev => {
      const updated = { ...prev, [id]: level };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
    if (isLoggedIn) {
      await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemId: id, mastery: level }),
      }).catch(console.error);
    }
  }, [isLoggedIn]);

  const saveNote = useCallback(async (id, note) => {
    setNotes(prev => {
      const updated = { ...prev, [id]: note };
      localStorage.setItem(NOTES_KEY, JSON.stringify(updated));
      return updated;
    });
    if (isLoggedIn) {
      await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemId: id, notes: note }),
      }).catch(console.error);
    }
  }, [isLoggedIn]);

  const solved = problems.filter(p => p.mastery !== "unseen").length;
  const today  = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">

        {/* Page sub-header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-xs text-gray-400 dark:text-gray-500">{today} · NeetCode 150</p>
          </div>
          <div className="flex items-center gap-3">
            {syncing && <span className="text-xs text-blue-500 animate-pulse">Syncing…</span>}
            <div className="text-right">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 leading-none">{solved}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">/ 150 attempted</p>
            </div>
          </div>
        </div>

        {/* Auth nudge for guests */}
        {status === "unauthenticated" && (
          <div className="mb-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              You&apos;re not signed in — progress is saved locally only.
            </p>
            <a href="/login" className="text-xs font-semibold text-amber-800 dark:text-amber-300 underline whitespace-nowrap">
              Sign in →
            </a>
          </div>
        )}

        <Stopwatch />
        <StatsBar problems={problems} lastMasteryAt={lastMasteryAt} />

        {/* Topic cards */}
        <TopicGrid problems={problems} />

        <Filters {...filters} onChange={handleFilterChange} />

        <p className="text-xs text-gray-400 dark:text-gray-500 mb-3 mt-1">
          {filtered.length} problems · Tap a row to expand · Click mastery to update
        </p>

        <ProblemTable
          problems={filtered}
          onSetMastery={setMastery}
          onSaveNote={saveNote}
          notes={notes}
          page={page}
          setPage={setPage}
        />
      </div>
    </div>
  );
}
