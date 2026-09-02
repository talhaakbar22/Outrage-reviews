import { getDb, nowInstant } from "@/lib/prisma";
import { enqueueProductRatingSync } from "@/lib/queue";
import { loadOfflineSessionByShopId } from "@/services/shop/service";
import { getProductById } from "@/services/products/repository";
import { updateProductRatingMetafields } from "@/lib/shopify/metafields";

export type RatingBreakdown = {
  "1": number;
  "2": number;
  "3": number;
  "4": number;
  "5": number;
};

export type ProductRatingStats = {
  productId: string;
  shopId: string;
  averageRating: number;
  reviewCount: number;
  ratingBreakdown: RatingBreakdown;
};

function emptyBreakdown(): RatingBreakdown {
  return { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
}

export async function recalculateProductRatings(
  productId: string,
): Promise<ProductRatingStats> {
  const db = getDb();
  const product = await db.orm.public.Product.where({ id: productId }).first();
  if (!product) {
    throw new Error(`Product ${productId} not found`);
  }

  const [aggregate, byRating] = await Promise.all([
    db.orm.public.Review.where({
      productId,
      status: "published",
    }).aggregate((agg) => ({
      reviewCount: agg.count(),
      averageRating: agg.avg("rating"),
    })),
    Promise.all(
      ([1, 2, 3, 4, 5] as const).map(async (rating) => {
        const result = await db.orm.public.Review.where({
          productId,
          status: "published",
          rating,
        }).aggregate((agg) => ({ count: agg.count() }));
        return { rating, count: result?.count ?? 0 };
      }),
    ),
  ]);

  const reviewCount = aggregate?.reviewCount ?? 0;
  const averageRating = reviewCount > 0 ? Number(aggregate?.averageRating ?? 0) : 0;
  const ratingBreakdown = emptyBreakdown();
  for (const item of byRating) {
    ratingBreakdown[String(item.rating) as keyof RatingBreakdown] = item.count;
  }

  await db.orm.public.Product.where({ id: productId }).update({
    avgRating: reviewCount > 0 ? averageRating : null,
    reviewCount,
    ratingBreakdown,
  });

  return {
    productId,
    shopId: product.shopId,
    averageRating,
    reviewCount,
    ratingBreakdown,
  };
}

/**
 * Recalculate local product ratings, then queue (or run) Shopify metafield sync.
 */
export async function publishProductRatings(productId: string) {
  const stats = await recalculateProductRatings(productId);
  await enqueueProductRatingSync({
    shopId: stats.shopId,
    productId: stats.productId,
  });
  return stats;
}

export async function syncProductRatingMetafields(productId: string) {
  const product = await getProductById(productId);
  if (!product) {
    throw new Error(`Product ${productId} not found`);
  }

  const session = await loadOfflineSessionByShopId(product.shopId);
  if (!session) {
    throw new Error(`No offline session for product shop ${product.shopId}`);
  }

  // Recalculate again at sync time so the job always writes the latest DB state.
  const ratings = await recalculateProductRatings(productId);
  const productGid = `gid://shopify/Product/${product.shopifyProductId}`;

  await updateProductRatingMetafields(session, productGid, {
    averageRating: ratings.averageRating,
    reviewCount: ratings.reviewCount,
    ratingBreakdown: ratings.ratingBreakdown,
  });

  await getDb().orm.public.Product.where({ id: productId }).update({
    lastSyncedAt: nowInstant(),
  });

  return ratings;
}
