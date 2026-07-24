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

  const reset = () => {
    setRunning(false);
    setElapsed(0);
    setHints(0);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
      <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">Practice timer</p>
      <div className="flex items-center gap-4 flex-wrap">
        <span className="text-4xl font-mono font-medium text-gray-800 tabular-nums">{display}</span>
        <div className="flex gap-2">
          <button
            onClick={() => setRunning(r => !r)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              running
                ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                : "bg-green-100 text-green-700 hover:bg-green-200"
            }`}
          >
            {running ? "Pause" : "Start"}
          </button>
          <button
            onClick={reset}
            className="px-4 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          >
            Reset
          </button>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-gray-500">Hints:</span>
          <button onClick={() => setHints(h => Math.max(0, h - 1))} className="w-6 h-6 rounded bg-gray-100 text-gray-600 text-sm hover:bg-gray-200">−</button>
          <span className="text-sm font-medium w-4 text-center text-gray-700">{hints}</span>
          <button onClick={() => setHints(h => h + 1)} className="w-6 h-6 rounded bg-gray-100 text-gray-600 text-sm hover:bg-gray-200">+</button>
        </div>
      </div>
    </div>
  );
}
