"use client";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useTheme } from "@/components/theme/theme-provider";

export function AppearanceSettings() {
  const { theme, resolvedTheme, mounted } = useTheme();

  return (
    <section className="mt-8 max-w-xl rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
        Appearance
      </h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Choose light or dark mode for the dashboard. Your choice is saved in this
        browser.
      </p>
      <div className="mt-4">
        <ThemeToggle />
      </div>
      {mounted ? (
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          Active theme:{" "}
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            {theme === "system"
              ? `System (${resolvedTheme})`
              : theme.charAt(0).toUpperCase() + theme.slice(1)}
          </span>
        </p>
      ) : null}
    </section>
  );
}
