"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

type ImportStatus = {
  id: string;
  status: string;
  payload?: Record<string, unknown>;
  errorMessage?: string | null;
};

export function LooxImportPanel({
  onCompleted,
}: {
  onCompleted?: () => void;
} = {}) {
  const searchParams = useSearchParams();
  const shop = searchParams.get("shop");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<ImportStatus | null>(null);

  async function pollStatus(syncJobId: string) {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const response = await fetch(`/api/import/loox?syncJobId=${syncJobId}`);
      const data = (await response.json()) as ImportStatus;
      setStatus(data);

      if (data.status === "completed" || data.status === "failed") {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setStatus(null);

    if (!shop) {
      setMessage("Missing shop context. Open this page from your connected dashboard.");
      return;
    }

    if (!file) {
      setMessage("Choose a Loox CSV export first.");
      return;
    }

    setBusy(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`/api/import/loox?shop=${encodeURIComponent(shop)}`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Import failed to start");
      }

      setMessage("Import started. Downloading review photos to your storage…");
      await pollStatus(data.syncJobId);
      setMessage("Import finished.");
      onCompleted?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  const payload = status?.payload as
    | {
        importedReviews?: number;
        skippedReviews?: number;
        failedRows?: number;
        downloadedImages?: number;
        failedImages?: number;
        productsUpdated?: number;
        errors?: string[];
      }
    | undefined;

  return (
    <section className="bg-white p-6 dark:bg-zinc-950">
      <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        Import from Loox
      </h2>
      <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        Upload your Loox CSV export. We match products by handle or Shopify product ID,
        download every review photo into your own storage, create review records, recalculate
        ratings, and sync Shopify metafields.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Loox CSV file
          <input
            type="file"
            accept=".csv,text/csv"
            className="mt-2 block w-full text-sm text-zinc-600 file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-950 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white dark:text-zinc-300 dark:file:bg-zinc-50 dark:file:text-zinc-950"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>

        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-950"
        >
          {busy ? "Importing…" : "Start Loox import"}
        </button>
      </form>

      {message ? <p className="mt-4 text-sm text-zinc-700 dark:text-zinc-300">{message}</p> : null}

      {status ? (
        <div className="mt-4 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
          <p>
            Job status: <span className="font-medium">{status.status}</span>
          </p>
          {payload ? (
            <ul className="list-disc space-y-1 pl-5">
              <li>Imported reviews: {payload.importedReviews ?? 0}</li>
              <li>Skipped duplicates: {payload.skippedReviews ?? 0}</li>
              <li>Failed rows: {payload.failedRows ?? 0}</li>
              <li>Downloaded images: {payload.downloadedImages ?? 0}</li>
              <li>Failed images: {payload.failedImages ?? 0}</li>
              <li>Products updated: {payload.productsUpdated ?? 0}</li>
            </ul>
          ) : null}
          {status.errorMessage ? (
            <p className="text-red-600 dark:text-red-400">{status.errorMessage}</p>
          ) : null}
          {payload?.errors && payload.errors.length > 0 ? (
            <details className="mt-2">
              <summary className="cursor-pointer font-medium">Recent errors</summary>
              <ul className="mt-2 max-h-48 list-disc space-y-1 overflow-auto pl-5">
                {payload.errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
