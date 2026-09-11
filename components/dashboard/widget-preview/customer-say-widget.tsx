"use client";

import { useCallback, useEffect, useState } from "react";
import { formatRating, formatReviewDate, StarRating } from "@/components/dashboard/review-ui";
import {
  buildFallbackCustomerSummary,
  isPlaceholderCustomerSummary,
  normalizeCustomerSayPayload,
} from "@/lib/customer-say";
import { reviewMatchesHighlight } from "@/lib/customer-say-highlights";

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
  const [activeHighlight, setActiveHighlight] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="rounded-[1.5rem] border border-zinc-200/90 bg-white/90 p-8 text-sm text-zinc-500 shadow-[0_18px_40px_-28px_rgba(24,24,27,0.35)] dark:border-zinc-800 dark:bg-zinc-950">
        Loading preview…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-[1.5rem] border border-dashed border-zinc-300 bg-white/70 p-8 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950">
        Select a product with reviews to preview this widget.
      </div>
    );
  }

  const payload = data;

  const monthLabel =
    payload.summaryMonthLabel ??
    (payload.summaryGeneratedAt
      ? formatMonthLabel(payload.summaryGeneratedAt)
      : "");
  const reviewCount = Math.max(
    Number(payload.count ?? 0),
    Number(payload.reviewsTotal ?? 0),
    payload.reviews?.length ?? 0,
  );
  const summarySourceCount = Math.max(
    Number(payload.summarySourceCount ?? 0),
    reviewCount,
  );
  const summaryText =
    isPlaceholderCustomerSummary(payload.summaryText) && reviewCount > 0
      ? buildFallbackCustomerSummary({
          productTitle: payload.productTitle,
          reviewCount,
          quotes: (payload.reviews ?? []).map(
            (review) => review.body || review.title,
          ),
          ratings: (payload.reviews ?? []).map((review) => Number(review.rating ?? 0)),
        })
      : payload.summaryText;
  const highlights = payload.highlights ?? [];
  const snippets = (payload.snippets ?? []).slice(0, 4);
  const reviews = (payload.reviews ?? []).filter((review) =>
    activeHighlight
      ? reviewMatchesHighlight(
          {
            id: review.id,
            rating: Number(review.rating ?? 0),
            title: review.title,
            body: review.body,
          },
          activeHighlight,
        )
      : true,
  );
  const showExpanded = expanded;

  function openHighlight(label: string) {
    setActiveHighlight(label);
    setExpanded(true);
    if ((payload.reviews?.length ?? 0) === 0 && onReadMore) onReadMore();
  }

  return (
    <div
      className={`relative overflow-hidden rounded-[1.5rem] border border-zinc-200/90 bg-gradient-to-br from-white via-zinc-50/80 to-white text-zinc-950 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_22px_48px_-34px_rgba(24,24,27,0.35)] dark:border-zinc-800 dark:from-zinc-950 dark:via-zinc-900/80 dark:to-zinc-950 dark:text-zinc-50 dark:shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_22px_48px_-30px_rgba(0,0,0,0.75)] ${
        compact ? "text-[13px]" : ""
      }`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-zinc-300 to-transparent dark:via-zinc-600"
      />
      <div className={`grid gap-6 ${compact ? "p-4" : "p-6 md:p-8"}`}>
        <div className="grid gap-6 md:grid-cols-[9.5rem_1fr] md:items-start">
          <div className="space-y-2">
            <p className="font-display text-5xl font-semibold tracking-[-0.04em] md:text-6xl">
              {data.rating ? formatRating(Number(data.rating)) : "—"}
            </p>
            <StarRating
              rating={Math.round(Number(data.rating ?? 0))}
            />
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
              {reviewCount.toLocaleString()} approved review
              {reviewCount === 1 ? "" : "s"}
            </p>
          </div>

          <div className="space-y-3">
            {hideSummary ? (
              <div className="flex justify-start md:justify-end">
                <button
                  type="button"
                  className="w-full shrink-0 rounded-full border border-zinc-900 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-900 transition hover:-translate-y-0.5 md:w-auto dark:border-zinc-100 dark:text-zinc-100"
                >
                  Write a review
                </button>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-display text-3xl font-semibold tracking-[-0.03em] text-zinc-950 md:text-4xl dark:text-zinc-50">
                    What customer says
                  </h2>
                  <button
                    type="button"
                    className="w-full shrink-0 rounded-full border border-zinc-900 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-900 transition hover:-translate-y-0.5 md:w-auto dark:border-zinc-100 dark:text-zinc-100"
                  >
                    Write a review
                  </button>
                </div>
                <p className="text-base leading-7 text-zinc-700 dark:text-zinc-300">
                  {summaryText}
                </p>
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
                  Summarised from {summarySourceCount.toLocaleString()} approved
                  reviews{monthLabel ? ` • ${monthLabel}` : ""}
                </p>
              </>
            )}
          </div>
        </div>

        {!hideSummary && highlights.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {highlights.map((item) => {
              const active =
                activeHighlight?.toLowerCase() === item.label.toLowerCase();
              return (
                <button
                  key={item.label}
                  type="button"
                  aria-pressed={active}
                  onClick={() => openHighlight(item.label)}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${
                    active
                      ? "border-zinc-900 bg-zinc-100 text-zinc-950 dark:border-zinc-100 dark:bg-zinc-800 dark:text-zinc-50"
                      : "border-zinc-200 bg-zinc-50 text-zinc-800 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-500"
                  }`}
                >
                  <span>{item.label}</span>
                  <span className="font-semibold text-zinc-950 dark:text-zinc-50">
                    {item.count}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        {!hideSummary && snippets.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {snippets.map((snippet) => (
              <article
                key={snippet.id}
                className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/60"
              >
                <p className="font-display text-[1.05rem] leading-6 tracking-[-0.015em] text-zinc-800 dark:text-zinc-200">
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
              onClick={() => {
                setExpanded(false);
                setActiveHighlight(null);
              }}
              className="justify-self-start text-sm font-medium text-zinc-800 underline underline-offset-4 dark:text-zinc-200"
            >
              Hide reviews
            </button>

            {activeHighlight ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-900/70">
                <p className="font-medium text-zinc-800 dark:text-zinc-200">
                  Showing reviews for “{activeHighlight}”
                </p>
                <button
                  type="button"
                  onClick={() => setActiveHighlight(null)}
                  className="font-semibold text-zinc-800 underline underline-offset-4 dark:text-zinc-200"
                >
                  Show all reviews
                </button>
              </div>
            ) : null}

            <div className="space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              {reviews.length === 0 && loadingMore ? (
                <p className="text-sm text-zinc-500">Loading reviews…</p>
              ) : null}
              {reviews.length === 0 && !loadingMore ? (
                <p className="text-sm text-zinc-500">
                  No reviews matched this theme yet.
                </p>
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
                        <StarRating rating={review.rating} />
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
