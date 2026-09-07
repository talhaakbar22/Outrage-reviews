"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
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
  media: Array<{
    id: string;
    url: string;
    thumbnailUrl: string | null;
    type: string;
  }>;
  createdAt: string;
};

type MediaItem = ReviewCardData["media"][number];

function isVideoMedia(item: { type: string; url: string }) {
  return (
    item.type === "video" || /\.(mp4|mov|webm|m4v)(\?|$)/i.test(item.url)
  );
}

function MediaThumb({
  item,
  className = "",
}: {
  item: MediaItem;
  className?: string;
}) {
  if (isVideoMedia(item)) {
    return (
      <video
        src={item.url}
        className={`h-full w-full object-cover ${className}`}
        muted
        playsInline
        preload="metadata"
      />
    );
  }

  return (
    <Image
      src={item.thumbnailUrl || item.url}
      alt="Review media"
      fill
      className={`object-cover ${className}`}
      unoptimized
    />
  );
}

function ReviewMediaGallery({
  media,
  initialIndex,
  onClose,
}: {
  media: MediaItem[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const current = media[index];

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") {
        setIndex((value) => (value + 1) % media.length);
      }
      if (event.key === "ArrowLeft") {
        setIndex((value) => (value - 1 + media.length) % media.length);
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [media.length, onClose]);

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Review media gallery"
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-4xl flex-col gap-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between text-sm text-white">
          <p>
            {index + 1} / {media.length}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white/10 px-3 py-1.5 font-medium text-white hover:bg-white/20"
          >
            Close
          </button>
        </div>

        <div className="relative flex min-h-[50vh] items-center justify-center overflow-hidden rounded-2xl bg-black">
          {isVideoMedia(current) ? (
            <video
              key={current.id}
              src={current.url}
              className="max-h-[75vh] w-full object-contain"
              controls
              playsInline
              autoPlay
            />
          ) : (
            <div className="relative h-[75vh] w-full">
              <Image
                src={current.url}
                alt={`Review media ${index + 1}`}
                fill
                className="object-contain"
                unoptimized
              />
            </div>
          )}

          {media.length > 1 ? (
            <>
              <button
                type="button"
                aria-label="Previous media"
                onClick={() =>
                  setIndex((value) => (value - 1 + media.length) % media.length)
                }
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 px-3 py-2 text-white hover:bg-black/80"
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Next media"
                onClick={() => setIndex((value) => (value + 1) % media.length)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 px-3 py-2 text-white hover:bg-black/80"
              >
                ›
              </button>
            </>
          ) : null}
        </div>

        {media.length > 1 ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {media.map((item, itemIndex) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setIndex(itemIndex)}
                className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border ${
                  itemIndex === index
                    ? "border-white"
                    : "border-transparent opacity-70 hover:opacity-100"
                }`}
              >
                <MediaThumb item={item} />
                {isVideoMedia(item) ? (
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30 text-[10px] text-white">
                    ▶
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ReviewMediaStack({
  media,
  onOpen,
}: {
  media: MediaItem[];
  onOpen: (index: number) => void;
}) {
  if (media.length === 0) return null;

  const first = media[0];
  const second = media[1];
  const remainingAfterFirst = media.length - 1;
  const showMoreOverlay = media.length > 2;

  return (
    <div className="flex shrink-0 gap-2">
      <button
        type="button"
        onClick={() => onOpen(0)}
        className="relative h-28 w-28 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <MediaThumb item={first} />
        {isVideoMedia(first) ? (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25">
            <span className="rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-semibold text-white">
              ▶ Video
            </span>
          </span>
        ) : null}
      </button>

      {second ? (
        <button
          type="button"
          onClick={() => onOpen(1)}
          className="relative h-28 w-28 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <MediaThumb item={second} />
          {showMoreOverlay ? (
            <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-sm font-semibold text-white">
              +{remainingAfterFirst} more
            </span>
          ) : isVideoMedia(second) ? (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25">
              <span className="rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-semibold text-white">
                ▶ Video
              </span>
            </span>
          ) : null}
        </button>
      ) : null}
    </div>
  );
}

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
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);

  const mediaLabel =
    review.media.length === 0
      ? ""
      : review.media.some(isVideoMedia)
        ? ` · ${review.media.length} media`
        : ` · ${review.media.length} photo(s)`;

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
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <StarRating rating={review.rating} />
            <StatusBadge status={review.status} />
          </div>
          <p className="mt-2 text-sm text-zinc-500">{review.product.title}</p>

          {review.title ? (
            <h3 className="mt-3 font-medium text-zinc-950 dark:text-zinc-50">
              {review.title}
            </h3>
          ) : null}

          <p className="mt-2 line-clamp-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
            {review.body || "No written review."}
          </p>

          <p className="mt-3 text-xs text-zinc-500">
            {review.reviewerName || "Customer"} ·{" "}
            {formatReviewDate(review.createdAt)}
            {mediaLabel}
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
        </div>

        <div className="flex shrink-0 flex-col items-end gap-3">
          <Link
            href={detailHref}
            className="text-sm font-medium text-zinc-700 underline dark:text-zinc-300"
          >
            View
          </Link>
          <ReviewMediaStack
            media={review.media}
            onOpen={(index) => setGalleryIndex(index)}
          />
        </div>
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

      {error ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}

      {galleryIndex !== null ? (
        <ReviewMediaGallery
          media={review.media}
          initialIndex={galleryIndex}
          onClose={() => setGalleryIndex(null)}
        />
      ) : null}
    </article>
  );
}
