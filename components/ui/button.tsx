import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  const styles =
    variant === "primary"
      ? "bg-zinc-950 text-white shadow-[0_10px_24px_-16px_rgba(24,24,27,0.65)] hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
      : "border border-zinc-300/90 bg-white/90 text-zinc-900 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_10px_24px_-18px_rgba(24,24,27,0.28)] hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:shadow-none dark:hover:bg-zinc-800";

  return (
    <button
      className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium tracking-[-0.01em] transition duration-200 ${styles} ${className}`}
      {...props}
    />
  );
}
