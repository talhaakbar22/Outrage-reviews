import type { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
};

export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-zinc-200/90 bg-white/90 p-5 text-zinc-950 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_16px_34px_-26px_rgba(24,24,27,0.35)] dark:border-zinc-800 dark:bg-zinc-950/90 dark:text-zinc-50 dark:shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_18px_36px_-24px_rgba(0,0,0,0.7)] ${className}`}
    >
      {children}
    </div>
  );
}
