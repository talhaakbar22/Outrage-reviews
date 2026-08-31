import { requireDashboardShop } from "@/lib/dashboard/shop-context";
import { getAnalyticsSummary } from "@/services/dashboard/data";
import { formatRating } from "@/components/dashboard/review-ui";

type AnalyticsPageProps = {
  searchParams: Promise<{ shop?: string; host?: string }>;
};

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const params = await searchParams;
  const { shop } = await requireDashboardShop(params);
  const summary = await getAnalyticsSummary(shop.id);
  const maxRatingCount = Math.max(1, ...summary.byRating.map((item) => item.count));

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
        Analytics
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Review volume, rating distribution, and request funnel.
      </p>

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm text-zinc-500">Published average</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-950 dark:text-zinc-50">
            {formatRating(summary.averageRating)} ★
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm text-zinc-500">Published reviews</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-950 dark:text-zinc-50">
            {summary.publishedCount.toLocaleString()}
          </p>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Status breakdown
          </h2>
          <ul className="mt-4 space-y-3">
            {summary.byStatus.map((item) => (
              <li key={item.status} className="flex items-center justify-between text-sm">
                <span className="capitalize text-zinc-600 dark:text-zinc-400">
                  {item.status}
                </span>
                <span className="font-medium text-zinc-950 dark:text-zinc-50">
                  {item.count.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Rating distribution
          </h2>
          <ul className="mt-4 space-y-3">
            {[...summary.byRating].reverse().map((item) => (
              <li key={item.rating} className="grid grid-cols-[2rem_1fr_3rem] items-center gap-3 text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">{item.rating}★</span>
                <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
                  <div
                    className="h-full rounded-full bg-amber-400"
                    style={{ width: `${(item.count / maxRatingCount) * 100}%` }}
                  />
                </div>
                <span className="text-right font-medium text-zinc-950 dark:text-zinc-50">
                  {item.count}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          Review request funnel
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-5">
          {summary.requestStats.map((item) => (
            <li
              key={item.status}
              className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-900"
            >
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                {item.status}
              </p>
              <p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
                {item.count}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
