import { Suspense } from "react";
import { DashboardNav } from "@/components/dashboard/nav";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-transparent text-zinc-950 dark:text-zinc-50">
      <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-white/80 backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-950/75">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="min-w-0">
            <p className="font-display text-xl font-semibold tracking-[-0.02em] text-zinc-950 dark:text-zinc-50">
              Outrage Reviews
            </p>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
              Luxury review studio
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ThemeToggle compact />
            <Suspense fallback={<div className="h-8 w-64" />}>
              <DashboardNav />
            </Suspense>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
