"use client";
import { useState, useEffect, useRef } from "react";

export default function Stopwatch() {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [hints, setHints] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  const pad = n => String(n).padStart(2, "0");
  const display = `${pad(Math.floor(elapsed / 60))}:${pad(elapsed % 60)}`;

  const reset = () => { setRunning(false); setElapsed(0); setHints(0); };

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-6 transition-colors duration-200">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium uppercase tracking-wide">Practice timer</p>
      <div className="flex items-center gap-4 flex-wrap">
        <span className="text-4xl font-mono font-medium text-gray-800 dark:text-gray-100 tabular-nums">{display}</span>
        <div className="flex gap-2">
          <button
            onClick={() => setRunning(r => !r)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              running
                ? "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800"
                : "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800"
            }`}
          >
            {running ? "Pause" : "Start"}
          </button>
          <button
            onClick={reset}
            className="px-4 py-1.5 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            Reset
          </button>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-gray-500 dark:text-gray-400">Hints:</span>
          <button onClick={() => setHints(h => Math.max(0, h - 1))} className="w-6 h-6 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-sm hover:bg-gray-200 dark:hover:bg-gray-700">−</button>
          <span className="text-sm font-medium w-4 text-center text-gray-700 dark:text-gray-200">{hints}</span>
          <button onClick={() => setHints(h => h + 1)} className="w-6 h-6 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-sm hover:bg-gray-200 dark:hover:bg-gray-700">+</button>
        </div>
      </div>
    </div>
  );
}
