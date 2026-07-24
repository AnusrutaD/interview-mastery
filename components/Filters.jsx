"use client";
import { CATEGORIES, DIFFICULTIES, MASTERY_CONFIG } from "@/data/problems";

const inputCls = "border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-600 transition-colors";

export default function Filters({ search, category, difficulty, mastery, dueOnly, onChange }) {
  return (
    <div className="flex flex-wrap gap-2 mb-3">
      <input
        type="text"
        placeholder="Search problems…"
        value={search}
        onChange={e => onChange("search", e.target.value)}
        className={`flex-1 min-w-40 ${inputCls}`}
      />
      <select value={category} onChange={e => onChange("category", e.target.value)} className={`flex-1 min-w-40 ${inputCls}`}>
        {CATEGORIES.map(c => <option key={c}>{c}</option>)}
      </select>
      <select value={difficulty} onChange={e => onChange("difficulty", e.target.value)} className={inputCls}>
        {DIFFICULTIES.map(d => <option key={d}>{d}</option>)}
      </select>
      <select value={mastery} onChange={e => onChange("mastery", e.target.value)} className={inputCls}>
        <option value="All">All mastery</option>
        {Object.entries(MASTERY_CONFIG).map(([k, v]) => (
          <option key={k} value={k}>{v.label}</option>
        ))}
      </select>

      {/* Due for review toggle */}
      <button
        onClick={() => onChange("dueOnly", !dueOnly)}
        className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors font-medium ${
          dueOnly
            ? "bg-red-500 border-red-500 text-white"
            : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-red-300 dark:hover:border-red-700 hover:text-red-500"
        }`}
      >
        🔴 Due
      </button>
    </div>
  );
}
