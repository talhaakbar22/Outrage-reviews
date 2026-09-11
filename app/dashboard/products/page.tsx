import { Suspense } from "react";
import { requireDashboardShop } from "@/lib/dashboard/shop-context";
import { listShopProductsPage } from "@/services/dashboard/data";
import { ProductsWorkspace } from "@/components/dashboard/products-workspace";

type ProductsPageProps = {
  searchParams: Promise<{
    shop?: string;
    host?: string;
    q?: string;
    status?: string;
    hasReviews?: string;
    minRating?: string;
    sort?: string;
    page?: string;
  }>;
};

function parseStatus(value: string | undefined) {
  if (value === "active" || value === "archived" || value === "draft") {
    return value;
  }
  return "all" as const;
}

function parseHasReviews(value: string | undefined) {
  if (value === "with" || value === "without") return value;
  return "all" as const;
}

function parseSort(value: string | undefined) {
  if (value === "rating" || value === "reviews") return value;
  return "title" as const;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams;
  const { shop, query } = await requireDashboardShop(params);

  const page = Math.max(Number(params.page ?? "1") || 1, 1);
  const minRatingRaw = Number(params.minRating);
  const minRating =
    Number.isFinite(minRatingRaw) && minRatingRaw >= 1 && minRatingRaw <= 5
      ? minRatingRaw
      : null;

  const result = await listShopProductsPage(shop.id, {
    search: params.q?.trim() || undefined,
    status: parseStatus(params.status),
    hasReviews: parseHasReviews(params.hasReviews),
    minRating,
    sort: parseSort(params.sort),
    page,
    pageSize: 20,
  });

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
        Products
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Synced Shopify products with live rating summaries.
      </p>

      <Suspense fallback={<p className="mt-8 text-sm text-zinc-500">Loading…</p>}>
        <ProductsWorkspace
          shop={shop.shopifyDomain}
          host={query.host}
          products={result.products}
          total={result.total}
          page={result.page}
          pageSize={result.pageSize}
          totalPages={result.totalPages}
          filters={{
            q: params.q?.trim() ?? "",
            status: parseStatus(params.status),
            hasReviews: parseHasReviews(params.hasReviews),
            minRating: minRating ? String(minRating) : "all",
            sort: parseSort(params.sort),
          }}
        />
      </Suspense>
    </main>
  );
}
