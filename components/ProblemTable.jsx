"use client";
import { MASTERY_CONFIG, DIFF_CONFIG, MASTERY_ORDER } from "@/data/problems";

export default function ProblemTable({ problems, onCycleMastery }) {
  if (problems.length === 0) {
    return (
      <div className="border border-gray-200 rounded-xl p-12 text-center text-gray-400 text-sm">
        No problems match your filters
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 w-10">#</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Problem</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 w-24 hidden sm:table-cell">Difficulty</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 w-28">Mastery</th>
          </tr>
        </thead>
        <tbody>
          {problems.map((p, i) => {
            const diff = DIFF_CONFIG[p.difficulty];
            const mst = MASTERY_CONFIG[p.mastery];
            return (
              <tr
                key={p.id}
                className={`border-b border-gray-100 last:border-0 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"} hover:bg-blue-50/40 transition-colors`}
              >
                <td className="px-4 py-3 text-gray-400 text-xs">{p.id}</td>
                <td className="px-4 py-3">
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-blue-600 hover:text-blue-800 hover:underline block truncate max-w-xs"
                    title={p.title}
                  >
                    {p.title}
                  </a>
                  <span className="text-xs text-gray-400">{p.category}</span>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${diff.bgColor} ${diff.textColor}`}>
                    {p.difficulty}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => onCycleMastery(p.id)}
                    title="Click to cycle mastery level"
                    className={`text-xs font-medium px-2 py-0.5 rounded-full cursor-pointer border-0 transition-opacity hover:opacity-75 ${mst.bgColor} ${mst.textColor}`}
                  >
                    {mst.label}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
