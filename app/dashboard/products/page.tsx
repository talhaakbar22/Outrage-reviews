import Image from "next/image";
import {
  requireDashboardShop,
} from "@/lib/dashboard/shop-context";
import { listShopProducts } from "@/services/dashboard/data";
import { formatRating } from "@/components/dashboard/review-ui";

type ProductsPageProps = {
  searchParams: Promise<{ shop?: string; host?: string }>;
};

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams;
  const { shop } = await requireDashboardShop(params);
  const products = await listShopProducts(shop.id);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
        Products
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Synced Shopify products with live rating summaries.
      </p>

      {products.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950">
          No products synced yet. Complete OAuth install and wait for the initial
          sync job.
        </div>
      ) : (
        <div className="mt-8 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
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
                    {formatRating(product.avgRating ?? 0)}
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
    </main>
  );
}
