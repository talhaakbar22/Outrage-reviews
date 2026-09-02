"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatReviewDate, StarRating, StatusBadge } from "@/components/dashboard/review-ui";

export type ReviewCardData = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  status: string;
  reviewerName: string | null;
  product: { title: string };
  media: Array<{ id: string; url: string; thumbnailUrl: string | null }>;
  createdAt: string;
};

export function ReviewModerationCard({
  review,
  detailHref,
}: {
  review: ReviewCardData;
  detailHref: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shop = searchParams.get("shop");
  const [busy, setBusy] = useState<"approve" | "reject" | "reply" | null>(null);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function moderate(action: "approve" | "reject") {
    if (!shop) return;
    setBusy(action);
    setError(null);

    try {
      const response = await fetch(
        `/api/reviews/${review.id}?shop=${encodeURIComponent(shop)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Action failed");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  async function submitReply(event: React.FormEvent) {
    event.preventDefault();
    if (!shop) return;
    setBusy("reply");
    setError(null);

    try {
      const response = await fetch(
        `/api/reviews/${review.id}?shop=${encodeURIComponent(shop)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "reply", body: replyBody }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Reply failed");
      }
      setReplyBody("");
      setReplyOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reply failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <StarRating rating={review.rating} />
            <StatusBadge status={review.status} />
          </div>
          <p className="mt-2 text-sm text-zinc-500">{review.product.title}</p>
        </div>
        <Link
          href={detailHref}
          className="text-sm font-medium text-zinc-700 underline dark:text-zinc-300"
        >
          View
        </Link>
      </div>

      {review.title ? (
        <h3 className="mt-3 font-medium text-zinc-950 dark:text-zinc-50">
          {review.title}
        </h3>
      ) : null}

      <p className="mt-2 line-clamp-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        {review.body || "No written review."}
      </p>

      <p className="mt-3 text-xs text-zinc-500">
        {review.reviewerName || "Customer"} · {formatReviewDate(review.createdAt)}
        {review.media.length > 0 ? ` · ${review.media.length} photo(s)` : ""}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {review.status === "pending" ? (
          <>
            <Button
              type="button"
              disabled={busy !== null}
              onClick={() => void moderate("approve")}
            >
              {busy === "approve" ? "Approving…" : "Approve"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy !== null}
              onClick={() => void moderate("reject")}
            >
              {busy === "reject" ? "Rejecting…" : "Reject"}
            </Button>
          </>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          disabled={busy !== null}
          onClick={() => setReplyOpen((open) => !open)}
        >
          Reply
        </Button>
      </div>

      {replyOpen ? (
        <form onSubmit={submitReply} className="mt-4 space-y-3">
          <textarea
            value={replyBody}
            onChange={(event) => setReplyBody(event.target.value)}
            required
            rows={3}
            placeholder="Write a public reply…"
            className="form-control"
          />
          <Button type="submit" disabled={busy !== null}>
            {busy === "reply" ? "Sending…" : "Send reply"}
          </Button>
        </form>
      ) : null}

      {error ? <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </article>
  );
}
