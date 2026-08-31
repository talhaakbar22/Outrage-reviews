import { Suspense } from "react";
import { DashboardNav } from "@/components/dashboard/nav";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            Outrage Reviews
          </p>
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
