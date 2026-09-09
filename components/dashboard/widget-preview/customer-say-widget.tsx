"use client";

import { useCallback, useEffect, useState } from "react";
import { formatRating, formatReviewDate, StarRating } from "@/components/dashboard/review-ui";
import {
  buildFallbackCustomerSummary,
  isPlaceholderCustomerSummary,
  normalizeCustomerSayPayload,
} from "@/lib/customer-say";

export type CustomerSayData = import("@/lib/customer-say").CustomerSayViewModel;

function formatMonthLabel(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

function ReplyToggle({
  replies,
}: {
  replies: Array<{
    body: string;
    authorName?: string | null;
    publishedAt?: string | null;
  }>;
}) {
  const [open, setOpen] = useState(false);
  if (!replies.length) return null;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="text-sm font-semibold text-zinc-800 underline underline-offset-4 dark:text-zinc-200"
      >
        {open
          ? replies.length > 1
            ? "Hide replies"
            : "Hide reply"
          : replies.length > 1
            ? `Replies (${replies.length})`
            : "Reply"}
      </button>
      {open ? (
        <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-3 dark:border-zinc-800 dark:bg-zinc-900/70">
          {replies.map((reply, index) => (
            <div
              key={`${reply.publishedAt ?? "reply"}-${index}`}
              className={
                index > 0
                  ? "border-t border-zinc-200 pt-3 dark:border-zinc-700"
                  : undefined
              }
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {reply.authorName || "Store reply"}
              </p>
              <p className="mt-1 text-sm leading-6 text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                {reply.body}
              </p>
              {reply.publishedAt ? (
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {formatReviewDate(reply.publishedAt)}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function CustomerSayWidgetPreview({
  data,
  loading,
  onReadMore,
  loadingMore,
  compact = false,
  hideSummary = false,
}: {
  data: CustomerSayData | null;
  loading?: boolean;
  onReadMore?: () => void;
  loadingMore?: boolean;
  compact?: boolean;
  hideSummary?: boolean;
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
  const reviewCount = Math.max(
    Number(data.count ?? 0),
    Number(data.reviewsTotal ?? 0),
    data.reviews?.length ?? 0,
  );
  const summarySourceCount = Math.max(
    Number(data.summarySourceCount ?? 0),
    reviewCount,
  );
  const summaryText =
    isPlaceholderCustomerSummary(data.summaryText) && reviewCount > 0
      ? buildFallbackCustomerSummary({
          productTitle: data.productTitle,
          reviewCount,
          quotes: (data.reviews ?? []).map(
            (review) => review.body || review.title,
          ),
          ratings: (data.reviews ?? []).map((review) => Number(review.rating ?? 0)),
        })
      : data.summaryText;
  const highlights = data.highlights ?? [];
  const snippets = (data.snippets ?? []).slice(0, 4);
  const reviews = data.reviews ?? [];
  const showExpanded = expanded;

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-zinc-200 bg-white text-zinc-950 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 ${
        compact ? "text-[13px]" : ""
      }`}
    >
      <div className={`grid gap-6 ${compact ? "p-4" : "p-6 md:p-8"}`}>
        <div className="grid gap-6 md:grid-cols-[9rem_1fr] md:items-start">
          <div className="space-y-2">
            <p className="text-4xl font-bold tracking-tight md:text-5xl">
              {data.rating ? formatRating(Number(data.rating)) : "—"}
            </p>
            <StarRating
              rating={Math.round(Number(data.rating ?? 0))}
              tone="dark"
            />
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 md:text-base">
              {reviewCount.toLocaleString()} approved review
              {reviewCount === 1 ? "" : "s"}
            </p>
          </div>

          <div className="space-y-3">
            {hideSummary ? (
              <div className="flex justify-start md:justify-end">
                <button
                  type="button"
                  className="w-full shrink-0 rounded-full border border-zinc-900 px-4 py-2.5 text-sm font-semibold text-zinc-900 md:w-auto dark:border-zinc-100 dark:text-zinc-100"
                >
                  Write a review
                </button>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-2xl font-bold tracking-tight text-zinc-950 md:text-3xl dark:text-zinc-50">
                    What customer says
                  </h2>
                  <button
                    type="button"
                    className="w-full shrink-0 rounded-full border border-zinc-900 px-4 py-2.5 text-sm font-semibold text-zinc-900 md:w-auto dark:border-zinc-100 dark:text-zinc-100"
                  >
                    Write a review
                  </button>
                </div>
                <p className="text-base leading-7 text-zinc-700 dark:text-zinc-300">
                  {summaryText}
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Summarised from {summarySourceCount.toLocaleString()} approved
                  reviews{monthLabel ? ` • ${monthLabel}` : ""}
                </p>
              </>
            )}
          </div>
        </div>

        {!hideSummary && highlights.length > 0 ? (
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

        {!hideSummary && snippets.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
                  <StarRating rating={snippet.rating} tone="dark" />
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

        {reviewCount > 0 && !showExpanded ? (
          <button
            type="button"
            onClick={() => {
              setExpanded(true);
              if (reviews.length === 0 && onReadMore) onReadMore();
            }}
            className="justify-self-start text-sm font-medium text-zinc-800 underline underline-offset-4 dark:text-zinc-200"
          >
            {`Read all ${reviewCount.toLocaleString()} reviews`}
          </button>
        ) : null}

        {reviewCount > 0 && showExpanded ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="justify-self-start text-sm font-medium text-zinc-800 underline underline-offset-4 dark:text-zinc-200"
            >
              Hide reviews
            </button>

            <div className="space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              {reviews.length === 0 && loadingMore ? (
                <p className="text-sm text-zinc-500">Loading reviews…</p>
              ) : null}
              {reviews.map((review) => {
                const media = review.media ?? [];
                const first = media[0];
                const second = media[1];
                const showMoreOverlay = media.length > 2;
                const dateLabel = formatReviewDate(
                  review.publishedAt || review.createdAt || "",
                );

                return (
                  <article
                    key={review.id}
                    className="flex flex-nowrap items-start gap-3 rounded-xl border border-zinc-200 p-4 md:gap-4 md:p-5 dark:border-zinc-800"
                  >
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2 text-base">
                          <span className="font-semibold text-zinc-950 dark:text-zinc-50">
                            {review.reviewerName || "Customer"}
                          </span>
                          {dateLabel ? (
                            <time className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                              {dateLabel}
                            </time>
                          ) : null}
                          {review.isVerifiedPurchase ? (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                              Verified
                            </span>
                          ) : null}
                        </div>
                        <StarRating rating={review.rating} tone="dark" />
                      </div>
                      {review.title ? (
                        <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                          {review.title}
                        </p>
                      ) : null}
                      {review.body ? (
                        <p className="text-base leading-7 text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                          {review.body}
                        </p>
                      ) : null}
                      {(() => {
                        const storeReplies = (review.replies ?? [])
                          .map((reply) => ({
                            body: String(reply.body ?? "").trim(),
                            authorName: reply.authorName ?? "Store team",
                            publishedAt: reply.publishedAt ?? null,
                          }))
                          .filter((reply) => reply.body.length > 0);
                        if (
                          storeReplies.length === 0 &&
                          review.merchantReply?.trim()
                        ) {
                          storeReplies.push({
                            body: review.merchantReply.trim(),
                            authorName: "Store team",
                            publishedAt: review.merchantRepliedAt ?? null,
                          });
                        }
                        return <ReplyToggle replies={storeReplies} />;
                      })()}
                    </div>

                    {media.length > 0 ? (
                      <div className="ml-auto flex shrink-0 gap-2">
                        {[first, second].filter(Boolean).map((item, index) => {
                          const src = item.thumbnailUrl || item.url;
                          const isVideo = item.type
                            .toLowerCase()
                            .includes("video");
                          const overlayMore =
                            index === 1 && showMoreOverlay
                              ? `+${media.length - 1} more`
                              : null;

                          return (
                            <a
                              key={item.id}
                              href={item.url}
                              target="_blank"
                              rel="noreferrer"
                              className="relative h-16 w-16 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 sm:h-24 sm:w-24 md:h-28 md:w-28 dark:border-zinc-700 dark:bg-zinc-900"
                              aria-label={
                                isVideo
                                  ? "Open review video"
                                  : "Open review photo"
                              }
                            >
                              {isVideo ? (
                                <video
                                  src={src}
                                  muted
                                  playsInline
                                  preload="metadata"
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={src}
                                  alt=""
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              )}
                              {overlayMore ? (
                                <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-sm font-semibold text-white">
                                  {overlayMore}
                                </span>
                              ) : isVideo ? (
                                <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25">
                                  <span className="rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-semibold text-white">
                                    ▶ Video
                                  </span>
                                </span>
                              ) : null}
                            </a>
                          );
                        })}
                      </div>
                    ) : null}
                  </article>
                );
              })}

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
    void load(true, 0, false);
  }, [load]);

  const readMore = useCallback(async () => {
    const hasLoadedReviews = (data?.reviews.length ?? 0) > 0;
    const offset = hasLoadedReviews ? (data?.reviews.length ?? 0) : 0;
    await load(true, offset, hasLoadedReviews);
  }, [data?.reviews.length, load]);

  return { data, loading, loadingMore, error, readMore, reload: load };
}
