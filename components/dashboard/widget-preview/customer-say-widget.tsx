"use client";

import { useCallback, useEffect, useState } from "react";
import { formatRating, StarRating } from "@/components/dashboard/review-ui";
import { normalizeCustomerSayPayload } from "@/lib/customer-say";

export type CustomerSayData = import("@/lib/customer-say").CustomerSayViewModel;

function formatMonthLabel(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

export function CustomerSayWidgetPreview({
  data,
  loading,
  onReadMore,
  loadingMore,
  compact = false,
}: {
  data: CustomerSayData | null;
  loading?: boolean;
  onReadMore?: () => void;
  loadingMore?: boolean;
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
        Loading preview…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950">
        Select a product with reviews to preview this widget.
      </div>
    );
  }

  const monthLabel =
    data.summaryMonthLabel ??
    (data.summaryGeneratedAt
      ? formatMonthLabel(data.summaryGeneratedAt)
      : "");
  const showExpanded = expanded || (data.reviews?.length ?? 0) > 0;
  const verifiedCount = Number(data.verifiedCount ?? 0);
  const summarySourceCount = Number(data.summarySourceCount ?? 0);
  const reviewCount = Number(data.count ?? 0);
  const highlights = data.highlights ?? [];
  const snippets = data.snippets ?? [];
  const reviews = data.reviews ?? [];

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-zinc-200 bg-white text-zinc-950 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 ${
        compact ? "text-[13px]" : ""
      }`}
    >
      <div className={`grid gap-6 ${compact ? "p-4" : "p-6 md:p-8"}`}>
        <div className="grid gap-6 md:grid-cols-[120px_1fr] md:items-start">
          <div className="space-y-2">
            <p className="text-4xl font-semibold tracking-tight">
              {data.rating ? formatRating(Number(data.rating)) : "—"}
            </p>
            <StarRating rating={Math.round(Number(data.rating ?? 0))} />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {verifiedCount.toLocaleString()} verified review
              {verifiedCount === 1 ? "" : "s"}
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex justify-end">
              <button
                type="button"
                className="shrink-0 rounded-full border border-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
              >
                Write a review
              </button>
            </div>
            <p className="text-sm leading-7 text-zinc-700 dark:text-zinc-300">
              {data.summaryText}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Summarised from {summarySourceCount.toLocaleString()} recent
              verified reviews{monthLabel ? ` • ${monthLabel}` : ""}
            </p>
          </div>
        </div>

        {highlights.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {highlights.map((item) => (
              <span
                key={item.label}
                className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              >
                <span>{item.label}</span>
                <span className="font-semibold text-zinc-950 dark:text-zinc-50">
                  {item.count}
                </span>
              </span>
            ))}
          </div>
        ) : null}

        {snippets.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {snippets.map((snippet) => (
              <article
                key={snippet.id}
                className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/60"
              >
                <p className="text-sm leading-6 text-zinc-800 dark:text-zinc-200">
                  “{snippet.quote}”
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">
                    {snippet.reviewerName || "Customer"}
                  </span>
                  <StarRating rating={snippet.rating} />
                  {snippet.isVerifiedPurchase ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                      Verified
                    </span>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {reviewCount > 0 ? (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => {
                if (!showExpanded && onReadMore) {
                  onReadMore();
                }
                setExpanded((value) => !value);
              }}
              className="text-sm font-medium text-zinc-800 underline underline-offset-4 dark:text-zinc-200"
            >
              {showExpanded
                ? "Hide reviews"
                : `Read all ${reviewCount.toLocaleString()} reviews`}
            </button>

            {showExpanded ? (
              <div className="space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                {reviews.map((review) => (
                  <article
                    key={review.id}
                    className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium text-zinc-950 dark:text-zinc-50">
                        {review.reviewerName || "Customer"}
                      </span>
                      <StarRating rating={review.rating} />
                      {review.isVerifiedPurchase ? (
                        <span className="text-xs text-emerald-700 dark:text-emerald-300">
                          Verified
                        </span>
                      ) : null}
                    </div>
                    {review.title ? (
                      <p className="mt-2 font-medium text-zinc-900 dark:text-zinc-100">
                        {review.title}
                      </p>
                    ) : null}
                    {review.body ? (
                      <p className="mt-1 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                        {review.body}
                      </p>
                    ) : null}
                  </article>
                ))}

                {data.hasMoreReviews && onReadMore ? (
                  <button
                    type="button"
                    disabled={loadingMore}
                    onClick={onReadMore}
                    className="btn-secondary"
                  >
                    {loadingMore ? "Loading…" : "Load more reviews"}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function useCustomerSayPreview(shop: string, productId: string | null) {
  const [data, setData] = useState<CustomerSayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (expand = false, offset = 0, append = false) => {
      if (!shop || !productId) {
        setLoading(false);
        setData(null);
        return;
      }
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ shop, product_id: productId });
        if (expand) {
          params.set("expand", "true");
          params.set("offset", String(offset));
          params.set("limit", "10");
        }

        const response = await fetch(`/api/widgets/customer-say?${params.toString()}`);
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load widget preview");
        }

        setData((current) => {
          const normalized = normalizeCustomerSayPayload(payload);
          if (!append || !current) return normalized;
          return {
            ...current,
            reviews: [...(current.reviews ?? []), ...(normalized.reviews ?? [])],
            reviewsOffset: normalized.reviewsOffset,
            reviewsLimit: normalized.reviewsLimit,
            hasMoreReviews: normalized.hasMoreReviews,
            reviewsTotal: normalized.reviewsTotal,
          };
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load preview");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [shop, productId],
  );

  useEffect(() => {
    setData(null);
    void load(false);
  }, [load]);

  const readMore = useCallback(async () => {
    const hasLoadedReviews = (data?.reviews.length ?? 0) > 0;
    const offset = hasLoadedReviews ? (data?.reviews.length ?? 0) : 0;
    await load(true, offset, hasLoadedReviews);
  }, [data?.reviews.length, load]);

  return { data, loading, loadingMore, error, readMore, reload: load };
}
