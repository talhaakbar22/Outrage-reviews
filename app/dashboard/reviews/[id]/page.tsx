import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import {
  requireDashboardShop,
  withShopPath,
} from "@/lib/dashboard/shop-context";
import { getDashboardReview } from "@/services/reviews/moderation";
import { ReviewModerationCard } from "@/components/dashboard/review-moderation-card";
import { StarRating, StatusBadge } from "@/components/dashboard/review-ui";
import { notFound } from "next/navigation";

type ReviewDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ shop?: string; host?: string }>;
};

export default async function ReviewDetailPage({
  params,
  searchParams,
}: ReviewDetailPageProps) {
  const [{ id }, queryParams] = await Promise.all([params, searchParams]);
  const { shop, query } = await requireDashboardShop(queryParams);
  const review = await getDashboardReview(shop.id, id);

  if (!review) {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <Link
        href={withShopPath("/dashboard/reviews", query)}
        className="text-sm font-medium text-zinc-600 underline dark:text-zinc-400"
      >
        ← Back to reviews
      </Link>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-wrap items-center gap-3">
            <StarRating rating={review.rating} />
            <StatusBadge status={review.status} />
            {review.isVerifiedPurchase ? (
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                Verified purchase
              </span>
            ) : null}
          </div>

          <h1 className="mt-4 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
            {review.title || "Customer review"}
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            {review.reviewerName || "Customer"}
            {review.reviewerEmail ? ` · ${review.reviewerEmail}` : ""} ·{" "}
            {review.createdAt.toLocaleString()} · source {review.source}
          </p>

          <p className="mt-6 whitespace-pre-wrap text-base leading-7 text-zinc-800 dark:text-zinc-200">
            {review.body || "No written review."}
          </p>

          {review.media.length > 0 ? (
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {review.media.map((item) => (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="relative aspect-square overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800"
                >
                  <Image
                    src={item.thumbnailUrl || item.url}
                    alt="Review media"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </a>
              ))}
            </div>
          ) : null}

          {review.replies.length > 0 ? (
            <div className="mt-8 space-y-4 border-t border-zinc-200 pt-6 dark:border-zinc-800">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Replies
              </h2>
              {review.replies.map((reply) => (
                <div key={reply.id} className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-900">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {reply.authorName || "Store team"}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                    {reply.body}
                  </p>
                  <p className="mt-2 text-xs text-zinc-500">
                    {reply.publishedAt.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-sm text-zinc-500">Product</p>
            <p className="mt-1 font-medium text-zinc-950 dark:text-zinc-50">
              {review.product.title}
            </p>
          </div>

          <Suspense fallback={null}>
            <ReviewModerationCard
              review={{
                ...review,
                createdAt: review.createdAt.toISOString(),
              }}
              detailHref={withShopPath(`/dashboard/reviews/${review.id}`, query)}
            />
          </Suspense>
        </aside>
      </div>
    </main>
  );
}
