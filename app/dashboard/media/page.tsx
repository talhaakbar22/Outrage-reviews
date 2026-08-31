import Image from "next/image";
import Link from "next/link";
import {
  requireDashboardShop,
  withShopPath,
} from "@/lib/dashboard/shop-context";
import { listShopMedia } from "@/services/dashboard/data";
import { StarRating } from "@/components/dashboard/review-ui";

type MediaPageProps = {
  searchParams: Promise<{ shop?: string; host?: string }>;
};

export default async function MediaPage({ searchParams }: MediaPageProps) {
  const params = await searchParams;
  const { shop, query } = await requireDashboardShop(params);
  const media = await listShopMedia(shop.id);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
        Media
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Customer photos attached to reviews.
      </p>

      {media.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950">
          No review photos yet.
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {media.map((item) => (
            <Link
              key={`${item.reviewId}-${item.id}`}
              href={withShopPath(`/dashboard/reviews/${item.reviewId}`, query)}
              className="group overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="relative aspect-square">
                <Image
                  src={item.thumbnailUrl || item.url}
                  alt={item.productTitle}
                  fill
                  className="object-cover transition group-hover:scale-[1.02]"
                  unoptimized
                />
              </div>
              <div className="p-3">
                <StarRating rating={item.rating} />
                <p className="mt-1 line-clamp-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {item.productTitle}
                </p>
                <p className="text-xs text-zinc-500">
                  {item.reviewerName || "Customer"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
