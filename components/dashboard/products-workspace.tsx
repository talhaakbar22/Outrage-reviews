"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { formatRating } from "@/components/dashboard/review-ui";
import type { ShopProductListItem } from "@/services/dashboard/data";

type ProductsWorkspaceProps = {
  shop: string;
  host?: string;
  products: ShopProductListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  filters: {
    q: string;
    status: string;
    hasReviews: string;
    minRating: string;
    sort: string;
  };
};

export function ProductsWorkspace({
  shop,
  host,
  products,
  total,
  page,
  pageSize,
  totalPages,
  filters,
}: ProductsWorkspaceProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(filters.q);
  const [status, setStatus] = useState(filters.status);
  const [hasReviews, setHasReviews] = useState(filters.hasReviews);
  const [minRating, setMinRating] = useState(filters.minRating);
  const [sort, setSort] = useState(filters.sort);

  const baseQuery = useMemo(() => {
    const params = new URLSearchParams();
    params.set("shop", shop);
    if (host) params.set("host", host);
    return params;
  }, [shop, host]);

  function pushFilters(nextPage = 1, overrides?: Partial<typeof filters>) {
    const params = new URLSearchParams(baseQuery);
    const next = {
      q,
      status,
      hasReviews,
      minRating,
      sort,
      ...overrides,
    };
    if (next.q.trim()) params.set("q", next.q.trim());
    if (next.status && next.status !== "all") params.set("status", next.status);
    if (next.hasReviews && next.hasReviews !== "all") {
      params.set("hasReviews", next.hasReviews);
    }
    if (next.minRating && next.minRating !== "all") {
      params.set("minRating", next.minRating);
    }
    if (next.sort && next.sort !== "title") params.set("sort", next.sort);
    if (nextPage > 1) params.set("page", String(nextPage));

    startTransition(() => {
      router.push(`/dashboard/products?${params.toString()}`);
    });
  }

  function goToPage(nextPage: number) {
    pushFilters(nextPage);
  }

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="mt-8 space-y-4">
      <form
        className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 md:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          pushFilters(1);
        }}
      >
        <label className="block text-sm text-zinc-700 dark:text-zinc-300 md:col-span-1">
          Search
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Title or handle"
            className="form-control mt-2"
          />
        </label>

        <label className="block text-sm text-zinc-700 dark:text-zinc-300">
          Status
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="form-control mt-2"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </label>

        <label className="block text-sm text-zinc-700 dark:text-zinc-300">
          Reviews
          <select
            value={hasReviews}
            onChange={(event) => setHasReviews(event.target.value)}
            className="form-control mt-2"
          >
            <option value="all">All</option>
            <option value="with">With reviews</option>
            <option value="without">No reviews</option>
          </select>
        </label>

        <label className="block text-sm text-zinc-700 dark:text-zinc-300">
          Min rating
          <select
            value={minRating}
            onChange={(event) => setMinRating(event.target.value)}
            className="form-control mt-2"
          >
            <option value="all">Any</option>
            <option value="4">4+</option>
            <option value="3">3+</option>
            <option value="2">2+</option>
            <option value="1">1+</option>
          </select>
        </label>

        <label className="block text-sm text-zinc-700 dark:text-zinc-300">
          Sort
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            className="form-control mt-2"
          >
            <option value="title">Title</option>
            <option value="rating">Rating</option>
            <option value="reviews">Review count</option>
          </select>
        </label>

        <div className="flex items-end gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Filtering…" : "Apply"}
          </Button>
          <button
            type="button"
            className="btn-secondary"
            disabled={pending}
            onClick={() => {
              setQ("");
              setStatus("all");
              setHasReviews("all");
              setMinRating("all");
              setSort("title");
              const params = new URLSearchParams(baseQuery);
              startTransition(() => {
                router.push(`/dashboard/products?${params.toString()}`);
              });
            }}
          >
            Reset
          </button>
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        <p>
          {total === 0
            ? "No products match these filters."
            : `Showing ${from}–${to} of ${total} products`}
        </p>
      </div>

      {products.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950">
          No products found. Try clearing filters, or sync products from Shopify.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Rating</th>
                <th className="px-4 py-3 font-medium">Reviews</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr
                  key={product.id}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {product.imageUrl ? (
                        <Image
                          src={product.imageUrl}
                          alt=""
                          width={40}
                          height={40}
                          className="h-10 w-10 rounded-lg object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-xs text-zinc-400 dark:bg-zinc-900">
                          —
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-zinc-950 dark:text-zinc-50">
                          {product.title}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {product.handle ?? product.shopifyProductId}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                    {product.avgRating != null && product.reviewCount > 0
                      ? formatRating(product.avgRating)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                    {product.reviewCount}
                  </td>
                  <td className="px-4 py-3 capitalize text-zinc-700 dark:text-zinc-300">
                    {product.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-zinc-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary"
              disabled={page <= 1 || pending}
              onClick={() => goToPage(page - 1)}
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, index) => index + 1)
              .filter((value) => {
                if (totalPages <= 7) return true;
                if (value === 1 || value === totalPages) return true;
                return Math.abs(value - page) <= 1;
              })
              .reduce<number[]>((acc, value, index, arr) => {
                if (index > 0 && value - arr[index - 1]! > 1) {
                  acc.push(-value);
                }
                acc.push(value);
                return acc;
              }, [])
              .map((value) =>
                value < 0 ? (
                  <span
                    key={`gap-${value}`}
                    className="px-1 text-sm text-zinc-400"
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={value}
                    type="button"
                    className={
                      value === page ? "btn-primary" : "btn-secondary"
                    }
                    disabled={pending}
                    onClick={() => goToPage(value)}
                  >
                    {value}
                  </button>
                ),
              )}
            <button
              type="button"
              className="btn-secondary"
              disabled={page >= totalPages || pending}
              onClick={() => goToPage(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
