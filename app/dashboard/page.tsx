import { Suspense } from "react";
import {
  requireDashboardShop,
  withShopPath,
} from "@/lib/dashboard/shop-context";
import { getDashboardStats } from "@/services/reviews/moderation";
import { ReviewModerationCard } from "@/components/dashboard/review-moderation-card";
import { formatRating } from "@/components/dashboard/review-ui";

type DashboardPageProps = {
  searchParams: Promise<{ shop?: string; host?: string }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const { shop, query } = await requireDashboardShop(params);
  const stats = await getDashboardStats(shop.id);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-10">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          Dashboard
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          {shop.name ?? shop.shopifyDomain}
        </h1>
        <p className="text-sm text-zinc-500">{shop.shopifyDomain}</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Average Rating"
          value={`${formatRating(stats.averageRating)} ★`}
        />
        <StatCard
          label="Total Reviews"
          value={stats.totalReviews.toLocaleString()}
        />
        <StatCard
          label="Photo Reviews"
          value={stats.photoReviews.toLocaleString()}
        />
        <StatCard
          label="Pending Reviews"
          value={stats.pendingReviews.toLocaleString()}
        />
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              Recent Reviews
            </h2>
            <p className="text-sm text-zinc-500">
              Approve, reject, or reply without leaving the overview.
            </p>
          </div>
        </div>

        {stats.recentReviews.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950">
            No reviews yet. Import Loox reviews or wait for customers to respond
            to review request emails.
          </div>
        ) : (
          <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
            <div className="grid gap-4">
              {stats.recentReviews.map((review) => (
                <ReviewModerationCard
                  key={review.id}
                  review={{
                    ...review,
                    createdAt: review.createdAt?.toISOString(),
                  }}
                  detailHref={withShopPath(
                    `/dashboard/reviews/${review.id}`,
                    query,
                  )}
                />
              ))}
            </div>
          </Suspense>
        )}
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
        {value}
      </p>
    </div>
  );
}
