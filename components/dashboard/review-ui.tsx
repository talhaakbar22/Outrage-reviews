export function StarRating({ rating }: { rating: number }) {
  return (
    <span className="tracking-tight text-amber-500" aria-label={`${rating} out of 5 stars`}>
      {"★".repeat(Math.max(0, Math.min(5, rating)))}
      <span className="text-zinc-300 dark:text-zinc-700">
        {"★".repeat(Math.max(0, 5 - Math.max(0, Math.min(5, rating))))}
      </span>
    </span>
  );
}

export function formatRating(value: number) {
  if (!value) return "—";
  return value.toFixed(1);
}

const REVIEW_DATE_LOCALE = "en-US";

export function formatReviewDate(iso: string) {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) {
    return iso;
  }

  return new Date(parsed).toLocaleDateString(REVIEW_DATE_LOCALE, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending:
      "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900",
    published:
      "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900",
    approved:
      "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900",
    rejected:
      "bg-red-50 text-red-800 ring-red-200 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-900",
    spam: "bg-zinc-100 text-zinc-700 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
        styles[status] ?? styles.spam
      }`}
    >
      {status}
    </span>
  );
}
