"use client";
import { useTheme } from "./ThemeProvider";

const OPTIONS = [
  { value: "light",  icon: "☀️",  label: "Light"  },
  { value: "dark",   icon: "🌙",  label: "Dark"   },
  { value: "system", icon: "💻",  label: "System" },
];

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const cycle = () => {
    const idx = OPTIONS.findIndex(o => o.value === theme);
    const next = OPTIONS[(idx + 1) % OPTIONS.length];
    setTheme(next.value);
  };

  const current = OPTIONS.find(o => o.value === theme) || OPTIONS[2];

  return (
    <button
      onClick={cycle}
      title={`Theme: ${current.label} (click to change)`}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
    >
      <span>{current.icon}</span>
      <span className="hidden sm:inline">{current.label}</span>
    </button>
  );
}
