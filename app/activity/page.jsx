"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { PROBLEMS, MASTERY_CONFIG, DIFF_CONFIG } from "@/data/problems";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// Get IST date components from a UTC timestamp
function istComponents(utcTs) {
  const d = new Date(new Date(utcTs).getTime() + IST_OFFSET_MS);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth(), date: d.getUTCDate(), day: d.getUTCDay() };
}

// UTC ms for IST midnight of the IST day containing utcTs
function istDayStart(utcTs) {
  const { year, month, date } = istComponents(utcTs);
  return Date.UTC(year, month, date) - IST_OFFSET_MS;
}

// UTC ms for Monday of the IST week containing utcTs
function istWeekStart(utcTs) {
  const { year, month, date, day } = istComponents(utcTs);
  const back = day === 0 ? 6 : day - 1;
  return Date.UTC(year, month, date - back) - IST_OFFSET_MS;
}

// UTC ms for 1st of the IST month containing utcTs
function istMonthStart(utcTs) {
  const { year, month } = istComponents(utcTs);
  return Date.UTC(year, month, 1) - IST_OFFSET_MS;
}

// UTC ms for 1st of the next IST month after monthStartUtc
function nextISTMonth(monthStartUtc) {
  const { year, month } = istComponents(monthStartUtc + IST_OFFSET_MS + 86400000);
  const nm = month + 1 > 11 ? 0 : month + 1;
  const ny = month + 1 > 11 ? year + 1 : year;
  return Date.UTC(ny, nm, 1) - IST_OFFSET_MS;
}

const DAY_MS  = 86400000;
const WEEK_MS = 7 * DAY_MS;

function fmtDate(utcTs) {
  return new Date(utcTs).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric",
  });
}
function fmtTime(utcTs) {
  return new Date(utcTs).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit",
  });
}
function fmtMonth(utcTs) {
  return new Date(utcTs + IST_OFFSET_MS).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata", month: "long", year: "numeric",
  });
}

// Build last N week options (most recent first)
function buildWeekOptions(n = 12) {
  const now = Date.now();
  const thisMonday = istWeekStart(now);
  return Array.from({ length: n }, (_, i) => {
    const start = thisMonday - i * WEEK_MS;
    const end   = start + WEEK_MS;
    return {
      start, end,
      label: i === 0
        ? `This Week  (${fmtDate(start)} – ${fmtDate(end - DAY_MS)})`
        : `${fmtDate(start)} – ${fmtDate(end - DAY_MS)}`,
    };
  });
}

// Build last N month options (most recent first)
function buildMonthOptions(n = 12) {
  const now = Date.now();
  let cur = istMonthStart(now);
  return Array.from({ length: n }, (_, i) => {
    const start = cur;
    const end   = nextISTMonth(start);
    const label = i === 0 ? `This Month  (${fmtMonth(start + IST_OFFSET_MS)})` : fmtMonth(start + IST_OFFSET_MS);
    cur = istMonthStart(start - DAY_MS); // go back one month
    return { start, end, label };
  });
}

const QUICK_TABS = [
  { key: "today",     label: "Today"      },
  { key: "yesterday", label: "Yesterday"  },
  { key: "week",      label: "This Week"  },
  { key: "month",     label: "This Month" },
];

export default function ActivityPage() {
  const { data: session, status } = useSession();

  const [progress,     setProgress]     = useState({});
  const [lastMasteryAt, setLastMasteryAt] = useState({});

  const [mode,          setMode]         = useState("today");
  const [weekIdx,       setWeekIdx]      = useState(0);
  const [monthIdx,      setMonthIdx]     = useState(0);

  const weekOptions  = useMemo(() => buildWeekOptions(12),  []);
  const monthOptions = useMemo(() => buildMonthOptions(12), []);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/progress")
      .then(r => r.json())
      .then(({ progress: p, lastMasteryAt: lm }) => {
        if (p)  setProgress(p);
        if (lm) setLastMasteryAt(lm);
      })
      .catch(console.error);
  }, [status]);

  // Compute period boundaries
  const { periodStart, periodEnd, periodLabel } = useMemo(() => {
    const now = Date.now();
    if (mode === "today") {
      const s = istDayStart(now);
      return { periodStart: s, periodEnd: s + DAY_MS, periodLabel: "Today" };
    }
    if (mode === "yesterday") {
      const s = istDayStart(now - DAY_MS);
      return { periodStart: s, periodEnd: s + DAY_MS, periodLabel: "Yesterday" };
    }
    if (mode === "week") {
      const w = weekOptions[weekIdx];
      return { periodStart: w.start, periodEnd: w.end, periodLabel: weekOptions[weekIdx].label.split("  ")[0] };
    }
    if (mode === "month") {
      const m = monthOptions[monthIdx];
      return { periodStart: m.start, periodEnd: m.end, periodLabel: monthOptions[monthIdx].label.split("  ")[0] };
    }
    return { periodStart: 0, periodEnd: 0, periodLabel: "" };
  }, [mode, weekIdx, monthIdx, weekOptions, monthOptions]);

  // Filter + sort problems in the selected period
  const solvedProblems = useMemo(() => {
    return PROBLEMS
      .filter(p => {
        const lm = lastMasteryAt[p.id];
        if (!lm || !progress[p.id] || progress[p.id] === "unseen") return false;
        const ts = new Date(lm).getTime();
        return ts >= periodStart && ts < periodEnd;
      })
      .map(p => ({ ...p, mastery: progress[p.id], lastMasteryAt: lastMasteryAt[p.id] }))
      .sort((a, b) => new Date(b.lastMasteryAt) - new Date(a.lastMasteryAt));
  }, [periodStart, periodEnd, progress, lastMasteryAt]);

  // Summary: by difficulty and mastery
  const summary = useMemo(() => {
    const byDiff    = { Easy: 0, Medium: 0, Hard: 0 };
    const byMastery = { learning: 0, familiar: 0, mastered: 0 };
    for (const p of solvedProblems) {
      if (byDiff[p.difficulty]    !== undefined) byDiff[p.difficulty]++;
      if (byMastery[p.mastery]    !== undefined) byMastery[p.mastery]++;
    }
    return { byDiff, byMastery };
  }, [solvedProblems]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8">

        {/* Header */}
        <div className="mb-6">
          <Link href="/" className="text-xs text-gray-400 dark:text-gray-500 hover:text-blue-500 transition-colors">
            ← Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">Activity</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Problems you&apos;ve practiced, by time period
          </p>
        </div>

        {/* Quick tabs */}
        <div className="flex flex-wrap gap-2 mb-4">
          {QUICK_TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => {
                setMode(key);
                if (key === "week")  setWeekIdx(0);
                if (key === "month") setMonthIdx(0);
              }}
              className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                mode === key
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-blue-300 dark:hover:border-blue-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Week / Month pickers */}
        <div className="flex gap-3 mb-5 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0">Week:</span>
            <select
              value={weekIdx}
              onChange={e => { setWeekIdx(Number(e.target.value)); setMode("week"); }}
              className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-600"
            >
              {weekOptions.map((w, i) => <option key={i} value={i}>{w.label}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0">Month:</span>
            <select
              value={monthIdx}
              onChange={e => { setMonthIdx(Number(e.target.value)); setMode("month"); }}
              className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-600"
            >
              {monthOptions.map((m, i) => <option key={i} value={i}>{m.label}</option>)}
            </select>
          </div>
        </div>

        {/* Summary cards */}
        {solvedProblems.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
            {[
              { label: "Easy",     val: summary.byDiff.Easy,         color: "text-green-600 dark:text-green-400"  },
              { label: "Medium",   val: summary.byDiff.Medium,       color: "text-yellow-600 dark:text-yellow-400"},
              { label: "Hard",     val: summary.byDiff.Hard,         color: "text-red-600 dark:text-red-400"      },
              { label: "Learning", val: summary.byMastery.learning,  color: "text-yellow-600 dark:text-yellow-400"},
              { label: "Familiar", val: summary.byMastery.familiar,  color: "text-blue-600 dark:text-blue-400"   },
              { label: "Mastered", val: summary.byMastery.mastered,  color: "text-green-600 dark:text-green-400" },
            ].map(({ label, val, color }) => (
              <div key={label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-2.5 text-center">
                <p className={`text-lg font-bold ${color}`}>{val}</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Problem list */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{periodLabel}</h2>
            <span className="text-xs font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-full">
              {solvedProblems.length} problem{solvedProblems.length !== 1 ? "s" : ""}
            </span>
          </div>

          {status !== "authenticated" ? (
            <div className="px-5 py-12 text-center text-sm text-gray-400">
              <Link href="/login" className="text-blue-500 hover:underline">Sign in</Link> to see your activity
            </div>
          ) : solvedProblems.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-2xl mb-2">📭</p>
              <p className="text-sm text-gray-400 dark:text-gray-500">No problems practiced in this period</p>
            </div>
          ) : (
            solvedProblems.map((p, idx) => {
              const diff = DIFF_CONFIG[p.difficulty];
              const mst  = MASTERY_CONFIG[p.mastery];
              const isLast = idx === solvedProblems.length - 1;
              return (
                <div
                  key={p.id}
                  className={`px-5 py-3.5 flex items-center gap-3 ${!isLast ? "border-b border-gray-100 dark:border-gray-800" : ""}`}
                >
                  {/* Left */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-xs text-gray-400 dark:text-gray-600 font-mono shrink-0">#{p.id}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${diff.bgColor} ${diff.textColor}`}>
                        {p.difficulty}
                      </span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${mst.bgColor} ${mst.textColor}`}>
                        {mst.label}
                      </span>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 hidden sm:inline">{p.category}</span>
                    </div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 leading-snug">{p.title}</p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                      🕐 {fmtDate(new Date(p.lastMasteryAt).getTime())} · {fmtTime(new Date(p.lastMasteryAt).getTime())}
                    </p>
                  </div>

                  {/* Right */}
                  <div className="flex gap-2 shrink-0">
                    <Link
                      href={`/problems/${p.id}`}
                      className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                    >
                      Detail →
                    </Link>
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-orange-500 hover:text-orange-600 dark:text-orange-400 transition-colors"
                    >
                      LC →
                    </a>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}
