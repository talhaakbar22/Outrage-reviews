"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type ReviewPageData = {
  product: {
    title: string;
    imageUrl: string | null;
  };
  shopName: string;
  customerName: string | null;
  emailHint: string;
};

type UploadedMedia = {
  mediaKey: string;
  publicUrl: string;
  sortOrder: number;
};

export function ReviewSubmissionForm({ token }: { token: string }) {
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [pageData, setPageData] = useState<ReviewPageData | null>(null);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [reviewerName, setReviewerName] = useState("");
  const [media, setMedia] = useState<UploadedMedia[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(`/api/review/${token}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? "Unable to load review request");
        }

        setPageData(data);
        setReviewerName(data.customerName ?? "");
      } catch (error) {
        setPageError(error instanceof Error ? error.message : "Unable to load review request");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [token]);

  async function handleUpload(file: File, index: number) {
    const permissionResponse = await fetch(`/api/review/${token}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contentType: file.type,
        contentLength: file.size,
        sortOrder: index,
      }),
    });

    const permission = await permissionResponse.json();
    if (!permissionResponse.ok) {
      throw new Error(permission.error ?? "Could not start upload");
    }

    const uploadResponse = await fetch(permission.uploadUrl, {
      method: "PUT",
      headers: permission.headers,
      body: file,
    });

    if (!uploadResponse.ok) {
      throw new Error("Direct upload failed");
    }

    setMedia((current) => {
      const next = current.filter((item) => item.sortOrder !== permission.sortOrder);
      next.push({
        mediaKey: permission.mediaKey,
        publicUrl: permission.publicUrl,
        sortOrder: permission.sortOrder,
      });
      return next.sort((a, b) => a.sortOrder - b.sortOrder);
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setSuccess(null);

    try {
      const response = await fetch(`/api/review/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          title,
          body,
          reviewerName,
          media: media.map((item) => ({
            mediaKey: item.mediaKey,
            sortOrder: item.sortOrder,
          })),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Submission failed");
      }

      setSuccess(data.message);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Submission failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading your review request…</p>;
  }

  if (pageError && !pageData) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
        {pageError}
      </div>
    );
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
        {success}
      </div>
    );
  }

  if (!pageData) {
    return null;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-sm text-zinc-500">{pageData.shopName}</p>
        <div className="mt-4 flex items-center gap-4">
          {pageData.product.imageUrl ? (
            <Image
              src={pageData.product.imageUrl}
              alt={pageData.product.title}
              width={72}
              height={72}
              className="h-[72px] w-[72px] rounded-xl object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-[72px] w-[72px] items-center justify-center rounded-xl bg-zinc-100 text-xs text-zinc-500 dark:bg-zinc-900">
              No image
            </div>
          )}
          <div>
            <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              {pageData.product.title}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Verified purchase for {pageData.emailHint}
            </p>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Rating
        </label>
        <div className="mt-2 flex gap-2">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              className={`h-10 w-10 rounded-full border text-sm font-medium ${
                rating >= value
                  ? "border-amber-400 bg-amber-100 text-amber-900"
                  : "border-zinc-300 text-zinc-500 dark:border-zinc-700"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Your name
        <input
          value={reviewerName}
          onChange={(event) => setReviewerName(event.target.value)}
          required
          className="mt-2 w-full rounded-xl border border-zinc-300 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Review title (optional)
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="mt-2 w-full rounded-xl border border-zinc-300 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Your review
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          required
          rows={5}
          className="mt-2 w-full rounded-xl border border-zinc-300 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Photos (optional, up to 5)
        </label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          multiple
          disabled={uploadingCount > 0 || media.length >= 5}
          className="mt-2 block w-full text-sm disabled:opacity-60"
          onChange={async (event) => {
            const files = Array.from(event.target.files ?? []).slice(0, 5 - media.length);
            setPageError(null);
            setUploadingCount(files.length);

            try {
              for (const [offset, file] of files.entries()) {
                const sortOrder = media.length + offset;
                await handleUpload(file, sortOrder);
              }
            } catch (error) {
              setPageError(error instanceof Error ? error.message : "Upload failed");
            } finally {
              setUploadingCount(0);
              event.target.value = "";
            }
          }}
        />
        {uploadingCount > 0 ? (
          <p className="mt-2 text-sm text-zinc-500">Uploading {uploadingCount} photo(s)…</p>
        ) : null}
        {media.length > 0 ? (
          <ul className="mt-3 grid grid-cols-5 gap-2">
            {media.map((item) => (
              <li key={item.mediaKey} className="relative aspect-square overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
                <Image
                  src={item.publicUrl}
                  alt={`Uploaded photo ${item.sortOrder + 1}`}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {pageError ? <p className="text-sm text-red-600 dark:text-red-400">{pageError}</p> : null}

      <button
        type="submit"
        disabled={busy || rating < 1 || uploadingCount > 0}
        className="inline-flex w-full items-center justify-center rounded-xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-950"
      >
        {busy ? "Submitting…" : "Submit review"}
      </button>
    </form>
  );
}
