"use client";
import { CATEGORIES, DIFFICULTIES, MASTERY_CONFIG } from "@/data/problems";

export default function Filters({ search, category, difficulty, mastery, onChange }) {
  return (
    <div className="flex flex-wrap gap-2 mb-3">
      <input
        type="text"
        placeholder="Search problems…"
        value={search}
        onChange={e => onChange("search", e.target.value)}
        className="flex-1 min-w-40 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
      />
      <select
        value={category}
        onChange={e => onChange("category", e.target.value)}
        className="flex-1 min-w-40 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
      >
        {CATEGORIES.map(c => <option key={c}>{c}</option>)}
      </select>
      <select
        value={difficulty}
        onChange={e => onChange("difficulty", e.target.value)}
        className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
      >
        {DIFFICULTIES.map(d => <option key={d}>{d}</option>)}
      </select>
      <select
        value={mastery}
        onChange={e => onChange("mastery", e.target.value)}
        className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
      >
        <option value="All">All mastery</option>
        {Object.entries(MASTERY_CONFIG).map(([k, v]) => (
          <option key={k} value={k}>{v.label}</option>
        ))}
      </select>
    </div>
  );
}
