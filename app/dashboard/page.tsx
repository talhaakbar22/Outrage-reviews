import { Suspense } from "react";
import {
  requireDashboardShop,
  withShopPath,
} from "@/lib/dashboard/shop-context";
import { toReviewCardData } from "@/components/dashboard/review-card-data";
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
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-6 py-10">
      <div className="relative overflow-hidden rounded-[1.75rem] border border-zinc-200/90 bg-white/90 p-7 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_24px_50px_-34px_rgba(24,24,27,0.35)] dark:border-zinc-800 dark:bg-zinc-950/90 dark:shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_24px_50px_-30px_rgba(0,0,0,0.75)] md:p-9">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(700px_280px_at_0%_0%,rgba(24,24,27,0.06),transparent_60%)] dark:bg-[radial-gradient(700px_280px_at_0%_0%,rgba(250,250,250,0.06),transparent_60%)]"
        />
        <div className="relative">
          <p className="lux-eyebrow">Dashboard</p>
          <h1 className="lux-page-title mt-2">
            {shop.name ?? shop.shopifyDomain}
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            {shop.shopifyDomain}
          </p>
        </div>
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
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="lux-section-title">Recent Reviews</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Approve, reject, or reply without leaving the overview.
            </p>
          </div>
        </div>

        {stats.recentReviews.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/70 p-8 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950/70">
            No reviews yet. Import Loox reviews or wait for customers to respond
            to review request emails.
          </div>
        ) : (
          <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
            <div className="grid gap-4">
              {stats.recentReviews.map((review) => (
                <ReviewModerationCard
                  key={review.id}
                  review={toReviewCardData(review)}
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
    <div className="group relative overflow-hidden rounded-2xl border border-zinc-200/90 bg-white/90 p-5 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_16px_34px_-26px_rgba(24,24,27,0.35)] transition duration-300 hover:-translate-y-0.5 dark:border-zinc-800 dark:bg-zinc-950/90 dark:shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_18px_36px_-24px_rgba(0,0,0,0.7)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-zinc-300 to-transparent dark:via-zinc-600"
      />
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="font-display mt-3 text-3xl font-semibold tracking-[-0.03em] text-zinc-950 dark:text-zinc-50 md:text-4xl">
        {value}
      </p>
    </div>
  );
}
