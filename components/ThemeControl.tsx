"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";
const applyTheme = (theme: Theme) => {
  const dark =
    theme === "dark" ||
    (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.dataset.themePreference = theme;
};

export function ThemeControl({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => {
    const saved = localStorage.getItem("pb-theme");
    const preference: Theme =
      saved === "light" || saved === "dark" ? saved : "system";
    setTheme(preference);
    applyTheme(preference);
    const media = matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      const current = localStorage.getItem("pb-theme");
      if (current !== "light" && current !== "dark") applyTheme("system");
    };
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  return (
    <label
      className={`theme-control${compact ? " theme-control-compact" : ""}`}
    >
      <span>Theme</span>
      <select
        value={theme}
        aria-label="Color theme"
        onChange={(event) => {
          const next = event.target.value as Theme;
          setTheme(next);
          if (next === "system") localStorage.removeItem("pb-theme");
          else localStorage.setItem("pb-theme", next);
          applyTheme(next);
        }}
      >
        <option value="light">☀️ Light</option>
        <option value="dark">🌙 Dark</option>
        <option value="system">💻 System</option>
      </select>
    </label>
  );
}
