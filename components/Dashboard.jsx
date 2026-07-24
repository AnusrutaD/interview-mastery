"use client";
import { useState, useMemo } from "react";
import { PROBLEMS, MASTERY_ORDER } from "@/data/problems";
import StatsBar from "./StatsBar";
import Filters from "./Filters";
import ProblemTable from "./ProblemTable";
import Stopwatch from "./Stopwatch";

const STORAGE_KEY = "leetcode-mastery-progress";

function loadProgress() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveProgress(progress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export default function Dashboard() {
  const [progress, setProgress] = useState(() => loadProgress());
  const [filters, setFilters] = useState({ search: "", category: "All", difficulty: "All", mastery: "All" });

  const problems = useMemo(() =>
    PROBLEMS.map(p => ({ ...p, mastery: progress[p.id] || "unseen" })),
    [progress]
  );

  const filtered = useMemo(() => problems.filter(p => {
    if (filters.category !== "All" && p.category !== filters.category) return false;
    if (filters.difficulty !== "All" && p.difficulty !== filters.difficulty) return false;
    if (filters.mastery !== "All" && p.mastery !== filters.mastery) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!p.title.toLowerCase().includes(q) && !p.leetcode.includes(q)) return false;
    }
    return true;
  }), [problems, filters]);

  const handleFilterChange = (key, value) => setFilters(f => ({ ...f, [key]: value }));

  const cycleMastery = (id) => {
    setProgress(prev => {
      const current = prev[id] || "unseen";
      const next = MASTERY_ORDER[(MASTERY_ORDER.indexOf(current) + 1) % MASTERY_ORDER.length];
      const updated = { ...prev, [id]: next };
      saveProgress(updated);
      return updated;
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">LeetCode Mastery</h1>
          <p className="text-sm text-gray-500 mt-1">NeetCode 150 — track your DSA interview prep</p>
        </div>

        {/* Stopwatch */}
        <Stopwatch />

        {/* Stats */}
        <StatsBar problems={problems} />

        {/* Filters */}
        <Filters {...filters} onChange={handleFilterChange} />

        <p className="text-xs text-gray-400 mb-2">
          {filtered.length} problems · Click any mastery badge to cycle it forward
        </p>

        {/* Table */}
        <ProblemTable problems={filtered} onCycleMastery={cycleMastery} />
      </div>
    </div>
  );
}
