"use client";
import { useTheme, type Theme } from "@/components/providers/ThemeProvider";

const LABELS: Record<Theme, { icon: string; label: string }> = {
  light: { icon: "☀️", label: "Light" },
  dark: { icon: "🌙", label: "Dark" },
  system: { icon: "💻", label: "System" },
};

export function ThemeToggle() {
  const { theme, cycleTheme } = useTheme();
  const current = LABELS[theme];

  return (
    <button
      type="button"
      onClick={cycleTheme}
      title={`Theme: ${current.label} (click to change)`}
      aria-label={`Switch theme, currently ${current.label}`}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
    >
      <span aria-hidden>{current.icon}</span>
      <span className="hidden sm:inline">{current.label}</span>
    </button>
  );
}
