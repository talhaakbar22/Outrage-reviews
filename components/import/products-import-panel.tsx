"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

type CsvResult = {
  totalRows?: number;
  created?: number;
  updated?: number;
  failedRows?: number;
  errors?: string[];
  productsSynced?: number;
  message?: string;
};

export function ProductsImportPanel() {
  const searchParams = useSearchParams();
  const shop = searchParams.get("shop");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<"csv" | "shopify" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<CsvResult | null>(null);

  async function syncFromShopify() {
    setMessage(null);
    setResult(null);

    if (!shop) {
      setMessage(
        "Missing shop context. Open this page from your connected dashboard.",
      );
      return;
    }

    setBusy("shopify");
    try {
      const response = await fetch(
        `/api/import/products?shop=${encodeURIComponent(shop)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "shopify" }),
        },
      );
      const data = (await response.json()) as CsvResult & { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Shopify sync failed");
      }
      setResult(data);
      setMessage(data.message ?? "Shopify product sync completed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Shopify sync failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleCsvSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setResult(null);

    if (!shop) {
      setMessage(
        "Missing shop context. Open this page from your connected dashboard.",
      );
      return;
    }

    if (!file) {
      setMessage("Choose a products CSV file first.");
      return;
    }

    setBusy("csv");
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `/api/import/products?shop=${encodeURIComponent(shop)}`,
        {
          method: "POST",
          body: formData,
        },
      );
      const data = (await response.json()) as CsvResult & { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "CSV import failed");
      }
      setResult(data);
      setMessage(data.message ?? "CSV import completed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "CSV import failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="bg-white p-6 dark:bg-zinc-950">
      <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        Import products
      </h2>
      <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        Pull products from your Shopify store into the dashboard, or upload a
        products CSV (Handle, Title, Product ID, Image Src, Status). Matching
        Loox reviews needs handles or Shopify product IDs in the catalog.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void syncFromShopify()}
          className="inline-flex items-center rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-950"
        >
          {busy === "shopify" ? "Syncing from store…" : "Sync products from store"}
        </button>
      </div>

      <form onSubmit={handleCsvSubmit} className="mt-8 space-y-4 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Or upload a products CSV
        </p>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Products CSV file
          <input
            type="file"
            accept=".csv,text/csv"
            className="mt-2 block w-full text-sm text-zinc-600 file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-950 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white dark:text-zinc-300 dark:file:bg-zinc-50 dark:file:text-zinc-950"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>

        <button
          type="submit"
          disabled={busy !== null}
          className="inline-flex items-center rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-950"
        >
          {busy === "csv" ? "Importing CSV…" : "Import products CSV"}
        </button>
      </form>

      {message ? (
        <p className="mt-4 text-sm text-zinc-700 dark:text-zinc-300">{message}</p>
      ) : null}

      {result ? (
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
          {typeof result.productsSynced === "number" ? (
            <li>Synced from Shopify: {result.productsSynced}</li>
          ) : null}
          {typeof result.totalRows === "number" ? (
            <li>CSV product rows: {result.totalRows}</li>
          ) : null}
          {typeof result.created === "number" ? (
            <li>Created: {result.created}</li>
          ) : null}
          {typeof result.updated === "number" ? (
            <li>Updated: {result.updated}</li>
          ) : null}
          {typeof result.failedRows === "number" ? (
            <li>Failed: {result.failedRows}</li>
          ) : null}
        </ul>
      ) : null}

      {result?.errors && result.errors.length > 0 ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-medium">
            Errors ({result.errors.length})
          </summary>
          <ul className="mt-2 max-h-48 list-disc space-y-1 overflow-auto pl-5 text-sm text-red-700 dark:text-red-300">
            {result.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
