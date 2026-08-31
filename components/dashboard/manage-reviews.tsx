"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LooxImportPanel } from "@/components/import/loox-import-panel";
import { StarRating } from "@/components/dashboard/review-ui";

type ManageReview = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  status: string;
  reviewerName: string | null;
  reviewerEmail: string | null;
  isVerifiedPurchase: boolean;
  source: string;
  merchantReply: string | null;
  createdAt: string;
  product: {
    id: string;
    title: string;
    imageUrl: string | null;
    handle: string | null;
    shopifyProductId: string;
  };
  media: Array<{ id: string; url: string; thumbnailUrl: string | null }>;
  replies: Array<{ id: string; body: string; authorName: string | null }>;
};

type ProductOption = { id: string; title: string };

type SettingsInfo = {
  autoPublishReviews: boolean;
  minRatingToPublish: number;
};

function sourceLabel(source: string) {
  switch (source) {
    case "email_request":
      return "Via review request email";
    case "import":
      return "Imported";
    case "widget":
      return "Via storefront widget";
    case "api":
      return "Via API";
    default:
      return "Native";
  }
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

function statusTone(status: string) {
  if (status === "published") {
    return "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:ring-emerald-800";
  }
  if (status === "pending") {
    return "bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:ring-amber-800";
  }
  if (status === "rejected") {
    return "bg-red-50 text-red-800 ring-red-200 dark:bg-red-950/60 dark:text-red-200 dark:ring-red-800";
  }
  return "bg-zinc-100 text-zinc-700 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700";
}

export function ManageReviewsWorkspace({
  shopDomain,
  detailBasePath,
}: {
  shopDomain: string;
  detailBasePath: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const host = searchParams.get("host");

  const [tab, setTab] = useState<"product" | "store">("product");
  const [reviews, setReviews] = useState<ManageReview[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [settings, setSettings] = useState<SettingsInfo | null>(null);
  const [total, setTotal] = useState(0);
  const [averageRating, setAverageRating] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const [draftQ, setDraftQ] = useState("");
  const [draftStatus, setDraftStatus] = useState("all");
  const [draftRating, setDraftRating] = useState("all");
  const [draftProductId, setDraftProductId] = useState("all");
  const [draftHasMedia, setDraftHasMedia] = useState(false);

  const [appliedQ, setAppliedQ] = useState("");
  const [appliedStatus, setAppliedStatus] = useState("all");
  const [appliedRating, setAppliedRating] = useState("all");
  const [appliedProductId, setAppliedProductId] = useState("all");
  const [appliedHasMedia, setAppliedHasMedia] = useState(false);
  const [sort, setSort] = useState<"newest" | "oldest" | "highest" | "lowest">(
    "newest",
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const shopQuery = useMemo(() => {
    const params = new URLSearchParams({ shop: shopDomain });
    if (host) params.set("host", host);
    return params.toString();
  }, [shopDomain, host]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        shop: shopDomain,
        meta: "1",
        sort,
        limit: "50",
      });
      if (appliedStatus !== "all") params.set("status", appliedStatus);
      if (appliedRating !== "all") params.set("rating", appliedRating);
      if (appliedProductId !== "all") params.set("productId", appliedProductId);
      if (appliedHasMedia) params.set("hasMedia", "true");
      if (appliedQ.trim()) params.set("q", appliedQ.trim());

      const response = await fetch(`/api/reviews?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to load reviews");

      setReviews(data.reviews ?? []);
      setTotal(data.total ?? 0);
      setAverageRating(Number(data.averageRating ?? 0));
      setProducts(data.products ?? []);
      setSettings(data.settings ?? null);
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reviews");
    } finally {
      setLoading(false);
    }
  }, [
    shopDomain,
    sort,
    appliedStatus,
    appliedRating,
    appliedProductId,
    appliedHasMedia,
    appliedQ,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  function applyFilters() {
    setAppliedQ(draftQ);
    setAppliedStatus(draftStatus);
    setAppliedRating(draftRating);
    setAppliedProductId(draftProductId);
    setAppliedHasMedia(draftHasMedia);
  }

  function clearFilters() {
    setDraftQ("");
    setDraftStatus("all");
    setDraftRating("all");
    setDraftProductId("all");
    setDraftHasMedia(false);
    setAppliedQ("");
    setAppliedStatus("all");
    setAppliedRating("all");
    setAppliedProductId("all");
    setAppliedHasMedia(false);
  }

  function toggleSelected(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === reviews.length) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(reviews.map((review) => review.id)));
  }

  async function patchReview(id: string, body: Record<string, unknown>) {
    setBusyIds((current) => new Set(current).add(id));
    try {
      const response = await fetch(`/api/reviews/${id}?shop=${encodeURIComponent(shopDomain)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Action failed");
      if (body.action === "suggest_reply") {
        setReplyDrafts((current) => ({
          ...current,
          [id]: data.suggestion ?? "",
        }));
        return;
      }
      await load();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusyIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  }

  async function bulkStatus(status: "published" | "pending" | "rejected") {
    if (selected.size === 0) return;
    setError(null);
    try {
      const response = await fetch(`/api/reviews?shop=${encodeURIComponent(shopDomain)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bulk_status",
          status,
          reviewIds: Array.from(selected),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Bulk update failed");
      await load();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk update failed");
    }
  }

  const activeFilterCount = [
    appliedStatus !== "all",
    appliedRating !== "all",
    appliedProductId !== "all",
    appliedHasMedia,
    Boolean(appliedQ.trim()),
  ].filter(Boolean).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Manage reviews
          </h1>
          <div className="mt-4 inline-flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900">
            <button
              type="button"
              onClick={() => setTab("product")}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium ${
                tab === "product"
                  ? "bg-white text-zinc-950 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
                  : "text-zinc-600 dark:text-zinc-400"
              }`}
            >
              Product reviews
            </button>
            <button
              type="button"
              onClick={() => setTab("store")}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium ${
                tab === "store"
                  ? "bg-white text-zinc-950 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
                  : "text-zinc-600 dark:text-zinc-400"
              }`}
            >
              Store reviews
            </button>
          </div>
        </div>
      </div>

      {tab === "store" ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center dark:border-zinc-700 dark:bg-zinc-950">
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Store reviews coming soon
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            v1 focuses on product reviews. Store-level reviews will land in a later release.
          </p>
        </div>
      ) : (
        <>
          {settings?.autoPublishReviews ? (
            <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100">
              Reviews with {settings.minRatingToPublish} stars and up will be instantly published.
              Lower-rated reviews stay pending until you approve them.
            </div>
          ) : (
            <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100">
              Auto-publish is off. New reviews stay pending until you publish them from this page.
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="font-medium text-zinc-950 dark:text-zinc-50">
                Total {total.toLocaleString()} reviews
              </span>
              <span className="inline-flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                <StarRating rating={Math.round(averageRating)} />
                <span className="font-semibold">{averageRating ? averageRating.toFixed(1) : "—"}</span>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setImportOpen((open) => !open)}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            >
              Import reviews
            </button>
          </div>

          {importOpen ? (
            <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
              <LooxImportPanel
                onCompleted={() => {
                  void load();
                  router.refresh();
                }}
              />
            </div>
          ) : null}

          <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                ⌕
              </span>
              <input
                value={draftQ}
                onChange={(event) => setDraftQ(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") applyFilters();
                }}
                placeholder="Search by email, display name, or review text"
                className="form-control py-2.5 pl-9"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={draftStatus}
                onChange={(event) => setDraftStatus(event.target.value)}
                className="form-control w-auto"
              >
                <option value="all">Status</option>
                <option value="published">Published</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
              </select>

              <select
                value={draftRating}
                onChange={(event) => setDraftRating(event.target.value)}
                className="form-control w-auto"
              >
                <option value="all">Rating</option>
                {[5, 4, 3, 2, 1].map((value) => (
                  <option key={value} value={value}>
                    {value} stars
                  </option>
                ))}
              </select>

              <select
                value={draftProductId}
                onChange={(event) => setDraftProductId(event.target.value)}
                className="form-control max-w-[220px] w-auto"
              >
                <option value="all">Product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.title}
                  </option>
                ))}
              </select>

              <label className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-800 dark:border-zinc-700 dark:text-zinc-200">
                <input
                  type="checkbox"
                  checked={draftHasMedia}
                  onChange={(event) => setDraftHasMedia(event.target.checked)}
                />
                Photo reviews
              </label>

              <div className="ml-auto flex items-center gap-3 text-sm">
                {activeFilterCount > 0 ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="font-medium text-zinc-600 underline dark:text-zinc-300"
                  >
                    Clear all
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={applyFilters}
                  className="rounded-xl bg-zinc-950 px-3.5 py-2 font-medium text-white dark:bg-zinc-50 dark:text-zinc-950"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="inline-flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={reviews.length > 0 && selected.size === reviews.length}
                  onChange={toggleSelectAll}
                />
                Select all {reviews.length} reviews
              </label>
              {selected.size > 0 ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void bulkStatus("published")}
                    className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white"
                  >
                    Publish ({selected.size})
                  </button>
                  <button
                    type="button"
                    onClick={() => void bulkStatus("pending")}
                    className="rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-medium text-white"
                  >
                    Set pending
                  </button>
                  <button
                    type="button"
                    onClick={() => void bulkStatus("rejected")}
                    className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-medium text-white"
                  >
                    Reject
                  </button>
                </div>
              ) : null}
            </div>

            <select
              value={sort}
              onChange={(event) =>
                setSort(event.target.value as typeof sort)
              }
              className="form-control w-auto"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="highest">Highest rating</option>
              <option value="lowest">Lowest rating</option>
            </select>
          </div>

          {error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : null}

          {loading ? (
            <p className="text-sm text-zinc-500">Loading reviews…</p>
          ) : reviews.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950">
              No reviews match these filters.
            </div>
          ) : (
            <div className="space-y-3">
              {reviews.map((review) => {
                const busy = busyIds.has(review.id);
                const detailHref = `${detailBasePath}/${review.id}?${shopQuery}`;
                return (
                  <article
                    key={review.id}
                    className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={selected.has(review.id)}
                        onChange={() => toggleSelected(review.id)}
                      />

                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-zinc-950 dark:text-zinc-50">
                                {review.reviewerName || "Customer"}
                              </p>
                              {review.isVerifiedPurchase ? (
                                <span
                                  className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-[10px] font-bold text-white"
                                  title="Verified purchase"
                                >
                                  ✓
                                </span>
                              ) : null}
                            </div>
                            <Link
                              href={detailHref}
                              className="mt-1 inline-flex items-center gap-1 text-sm text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
                            >
                              {review.product.title}
                              <span aria-hidden>↗</span>
                            </Link>
                          </div>

                          <div className="relative">
                            <button
                              type="button"
                              onClick={() =>
                                setMenuOpenId((current) =>
                                  current === review.id ? null : review.id,
                                )
                              }
                              className="rounded-lg px-2 py-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                              aria-label="More actions"
                            >
                              ⋯
                            </button>
                            {menuOpenId === review.id ? (
                              <div className="absolute right-0 z-10 mt-1 w-40 rounded-xl border border-zinc-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                                <Link
                                  href={detailHref}
                                  className="block px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                >
                                  Open details
                                </Link>
                                <button
                                  type="button"
                                  className="block w-full px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                  onClick={() =>
                                    void patchReview(review.id, {
                                      action: "set_status",
                                      status: "rejected",
                                    })
                                  }
                                >
                                  Mark as rejected
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-500">
                          <StarRating rating={review.rating} />
                          <span>{relativeTime(review.createdAt)}</span>
                          <span>{sourceLabel(review.source)}</span>
                          {review.media.length > 0 ? (
                            <span>{review.media.length} photo(s)</span>
                          ) : null}
                        </div>

                        {review.title ? (
                          <p className="font-medium text-zinc-900 dark:text-zinc-100">
                            {review.title}
                          </p>
                        ) : null}
                        <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                          {review.body || "No written review."}
                        </p>

                        {review.media.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {review.media.map((item) => (
                              <a
                                key={item.id}
                                href={item.url}
                                target="_blank"
                                rel="noreferrer"
                                className="relative h-16 w-16 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800"
                              >
                                <Image
                                  src={item.thumbnailUrl || item.url}
                                  alt=""
                                  fill
                                  className="object-cover"
                                  unoptimized
                                />
                              </a>
                            ))}
                          </div>
                        ) : null}

                        <div className="flex flex-wrap items-center gap-3">
                          <select
                            value={review.status}
                            disabled={busy}
                            onChange={(event) =>
                              void patchReview(review.id, {
                                action: "set_status",
                                status: event.target.value,
                              })
                            }
                            className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${statusTone(review.status)}`}
                          >
                            <option value="published">Published</option>
                            <option value="pending">Pending</option>
                            <option value="rejected">Rejected</option>
                          </select>
                        </div>

                        {review.merchantReply || review.replies[0] ? (
                          <div className="rounded-xl bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-900">
                            <p className="font-medium text-zinc-800 dark:text-zinc-200">
                              Your reply
                            </p>
                            <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                              {review.merchantReply || review.replies[0]?.body}
                            </p>
                          </div>
                        ) : null}

                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            value={replyDrafts[review.id] ?? ""}
                            onChange={(event) =>
                              setReplyDrafts((current) => ({
                                ...current,
                                [review.id]: event.target.value,
                              }))
                            }
                            placeholder="Add a reply..."
                            className="form-control min-w-[220px] flex-1"
                          />
                          <button
                            type="button"
                            disabled={busy || !(replyDrafts[review.id] ?? "").trim()}
                            onClick={() =>
                              void patchReview(review.id, {
                                action: "reply",
                                body: replyDrafts[review.id],
                              })
                            }
                            className="rounded-xl bg-zinc-950 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950"
                          >
                            Reply
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void patchReview(review.id, {
                                action: "suggest_reply",
                              })
                            }
                            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
                          >
                            <span aria-hidden>✦</span>
                            Suggest reply
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
