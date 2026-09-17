"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

type ImportPayload = {
  phase?: string;
  totalRows?: number;
  processedRows?: number;
  importedReviews?: number;
  skippedReviews?: number;
  failedRows?: number;
  downloadedImages?: number;
  failedImages?: number;
  productsUpdated?: number;
  errors?: string[];
  byteSize?: number;
};

type ImportStatus = {
  id: string;
  status: string;
  payload?: ImportPayload | null;
  errorMessage?: string | null;
};

function asPayload(value: unknown): ImportPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as ImportPayload;
}

function countLabel(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

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

  async function pollStatus(syncJobId: string): Promise<ImportStatus> {
    let latest: ImportStatus | null = null;

    for (let attempt = 0; attempt < 180; attempt += 1) {
      const response = await fetch(
        `/api/import/loox?syncJobId=${encodeURIComponent(syncJobId)}`,
      );
      const data = (await response.json()) as ImportStatus & { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load import status");
      }

      latest = {
        id: data.id,
        status: data.status,
        payload: asPayload(data.payload),
        errorMessage: data.errorMessage ?? null,
      };
      setStatus(latest);

      if (latest.status === "completed" || latest.status === "failed") {
        return latest;
      }

      if (attempt === 2 && latest.status === "pending") {
        setMessage(
          "Still queued… make sure the Loox import worker is running (`yarn worker:import`).",
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    throw new Error(
      latest
        ? `Import timed out while status was "${latest.status}". Check that yarn worker:import is running, then refresh this page.`
        : "Import timed out before status could be loaded.",
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setStatus(null);

    if (!shop) {
      setMessage(
        "Missing shop context. Open this page from your connected dashboard.",
      );
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

      const response = await fetch(
        `/api/import/loox?shop=${encodeURIComponent(shop)}`,
        {
          method: "POST",
          body: formData,
        },
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Import failed to start");
      }

      setMessage(
        "Import queued. Waiting for the worker to process reviews and photos…",
      );
      const finalStatus = await pollStatus(String(data.syncJobId));

      if (finalStatus.status === "failed") {
        setMessage(
          finalStatus.errorMessage
            ? `Import failed: ${finalStatus.errorMessage}`
            : "Import failed. See errors below.",
        );
        return;
      }

      const payload = asPayload(finalStatus.payload);
      const imported = countLabel(payload?.importedReviews);
      const failed = countLabel(payload?.failedRows);
      const skipped = countLabel(payload?.skippedReviews);
      setMessage(
        `Import completed. Imported ${imported}, skipped ${skipped}, failed ${failed}.`,
      );
      onCompleted?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  const payload = asPayload(status?.payload);
  const productErrors =
    payload?.errors?.filter((error) =>
      /no matching product|productId=|handle=/i.test(error),
    ) ?? [];
  const otherErrors =
    payload?.errors?.filter(
      (error) => !/no matching product|productId=|handle=/i.test(error),
    ) ?? [];

  return (
    <section className="bg-white p-6 dark:bg-zinc-950">
      <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        Import from Loox
      </h2>
      <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        Upload your Loox CSV export. We match products by handle or Shopify
        product ID, download every review photo into your own storage, create
        review records, recalculate ratings, and sync Shopify metafields.
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

      {message ? (
        <p className="mt-4 text-sm text-zinc-700 dark:text-zinc-300">{message}</p>
      ) : null}

      {status ? (
        <div className="mt-4 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
          <p>
            Job status:{" "}
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {status.status}
            </span>
            {payload?.phase ? (
              <span className="text-zinc-500"> · phase: {payload.phase}</span>
            ) : null}
          </p>

          <ul className="list-disc space-y-1 pl-5">
            <li>CSV rows: {countLabel(payload?.totalRows)}</li>
            <li>Processed: {countLabel(payload?.processedRows)}</li>
            <li>Imported reviews: {countLabel(payload?.importedReviews)}</li>
            <li>Skipped duplicates: {countLabel(payload?.skippedReviews)}</li>
            <li>Failed rows: {countLabel(payload?.failedRows)}</li>
            <li>Downloaded images: {countLabel(payload?.downloadedImages)}</li>
            <li>Failed images: {countLabel(payload?.failedImages)}</li>
            <li>Products updated: {countLabel(payload?.productsUpdated)}</li>
          </ul>

          {status.errorMessage ? (
            <p className="text-red-600 dark:text-red-400">{status.errorMessage}</p>
          ) : null}

          {productErrors.length > 0 ? (
            <details className="mt-2" open>
              <summary className="cursor-pointer font-medium text-zinc-800 dark:text-zinc-200">
                Product match failures ({productErrors.length})
              </summary>
              <ul className="mt-2 max-h-56 list-disc space-y-1 overflow-auto pl-5 text-red-700 dark:text-red-300">
                {productErrors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </details>
          ) : null}

          {otherErrors.length > 0 ? (
            <details className="mt-2">
              <summary className="cursor-pointer font-medium">
                Other errors ({otherErrors.length})
              </summary>
              <ul className="mt-2 max-h-48 list-disc space-y-1 overflow-auto pl-5">
                {otherErrors.map((error) => (
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
