"use client";

import { useTheme } from "@/components/theme/theme-provider";
import type { Theme } from "@/lib/theme";

const options: Array<{ value: Theme; label: string; icon: string }> = [
  { value: "light", label: "Light", icon: "☀" },
  { value: "dark", label: "Dark", icon: "☾" },
  // { value: "system", label: "System", icon: "◐" },
];

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme, mounted } = useTheme();

  if (!mounted) {
    return (
      <div
        className="h-9 w-[132px] rounded-xl bg-zinc-100 dark:bg-zinc-900"
        aria-hidden
      />
    );
  }

  return (
    <div
      className="inline-flex rounded-xl border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-700 dark:bg-zinc-900"
      role="group"
      aria-label="Color theme"
    >
      {options.map((option) => {
        const active = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setTheme(option.value)}
            aria-pressed={active}
            title={option.label}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
              active
                ? "bg-white text-zinc-950 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
                : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
            }`}
          >
            <span aria-hidden>{option.icon}</span>
            {compact ? null : <span>{option.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
