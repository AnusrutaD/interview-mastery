"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];

const STORAGE_KEY = "theme";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  cycleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  // Failing loudly beats silently rendering an untoggleable button.
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
  return ctx;
}

function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

function prefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && prefersDark());
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const initial: Theme = isTheme(stored) ? stored : "system";
    setThemeState(initial);
    applyTheme(initial);

    // Only react to OS changes while actually following the system.
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const current = window.localStorage.getItem(STORAGE_KEY);
      if (!isTheme(current) || current === "system") applyTheme("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  }, []);

  const cycleTheme = useCallback(() => {
    setThemeState((current) => {
      const next = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
      window.localStorage.setItem(STORAGE_KEY, next);
      applyTheme(next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ theme, setTheme, cycleTheme }), [theme, setTheme, cycleTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
