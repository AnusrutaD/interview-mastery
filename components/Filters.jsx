"use client";
import { CATEGORIES, DIFFICULTIES, MASTERY_CONFIG } from "@/data/problems";

const inputCls = "border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-600 transition-colors";

export default function Filters({ search, category, difficulty, mastery, onChange }) {
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
    </div>
  );
}
