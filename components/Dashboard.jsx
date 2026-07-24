"use client";
import { useState, useMemo } from "react";
import { PROBLEMS, MASTERY_ORDER } from "@/data/problems";
import StatsBar from "./StatsBar";
import Filters from "./Filters";
import ProblemTable from "./ProblemTable";
import Stopwatch from "./Stopwatch";

const STORAGE_KEY = "lc-mastery-progress";
const NOTES_KEY   = "lc-mastery-notes";
const PAGE_KEY    = "lc-mastery-page";

function load(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; }
  catch { return fallback; }
}

export default function Dashboard() {
  const [progress, setProgress] = useState(() => load(STORAGE_KEY, {}));
  const [notes,    setNotes]    = useState(() => load(NOTES_KEY, {}));
  const [page,     setPageRaw]  = useState(() => load(PAGE_KEY, 1));
  const [filters,  setFilters]  = useState({ search: "", category: "All", difficulty: "All", mastery: "All" });

  const setPage = (fn) => {
    setPageRaw(prev => {
      const next = typeof fn === "function" ? fn(prev) : fn;
      localStorage.setItem(PAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const problems = useMemo(() =>
    PROBLEMS.map(p => ({ ...p, mastery: progress[p.id] || "unseen" })),
    [progress]
  );

  const filtered = useMemo(() => {
    return problems.filter(p => {
      if (filters.category !== "All" && p.category !== filters.category) return false;
      if (filters.difficulty !== "All" && p.difficulty !== filters.difficulty) return false;
      if (filters.mastery !== "All" && p.mastery !== filters.mastery) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (!p.title.toLowerCase().includes(q) && !p.leetcode.includes(q)) return false;
      }
      return true;
    });
  }, [problems, filters]);

  const handleFilterChange = (key, value) => {
    setFilters(f => ({ ...f, [key]: value }));
    setPage(1);
  };

  const setMastery = (id, level) => {
    setProgress(prev => {
      const updated = { ...prev, [id]: level };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const saveNote = (id, note) => {
    setNotes(prev => {
      const updated = { ...prev, [id]: note };
      localStorage.setItem(NOTES_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const solved   = problems.filter(p => p.mastery === "mastered" || p.mastery === "familiar").length;
  const today    = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-5 gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">LeetCode Mastery</h1>
            <p className="text-xs text-gray-400 mt-0.5">{today} · NeetCode 150</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold text-blue-600">{solved}</p>
            <p className="text-xs text-gray-400">/ 150 solved</p>
          </div>
        </div>

        {/* Stopwatch */}
        <Stopwatch />

        {/* Stats */}
        <StatsBar problems={problems} />

        {/* Filters */}
        <Filters {...filters} onChange={handleFilterChange} />

        <p className="text-xs text-gray-400 mb-3 mt-1">
          {filtered.length} problems · Tap a row to expand · Click mastery to update
        </p>

        {/* Table */}
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
