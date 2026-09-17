import { getDb } from "@/lib/prisma";
import { getShopByDomain } from "@/services/storefront/reviews";
import { APPROVED_REVIEW_STATUSES } from "@/services/reviews/ai-summary";

export type ProductCardRating = {
  shopifyProductId: string;
  handle: string | null;
  avgRating: number;
  reviewCount: number;
};

function normalizeIds(values: string[]) {
  return [
    ...new Set(
      values
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => value.replace(/\D/g, "") || value)
        .filter(Boolean),
    ),
  ].slice(0, 120);
}

function normalizeHandles(values: string[]) {
  return [
    ...new Set(
      values
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean)
        .map((value) => value.replace(/^\/products\//, "").split(/[?#]/)[0]!)
        .filter(Boolean),
    ),
  ].slice(0, 120);
}

async function liveRatingsForProductIds(
  productIds: string[],
): Promise<Map<string, { avgRating: number; reviewCount: number }>> {
  const db = getDb();
  const map = new Map<string, { avgRating: number; reviewCount: number }>();
  if (productIds.length === 0) return map;

  await Promise.all(
    productIds.map(async (productId) => {
      const aggregate = await db.orm.public.Review.where({ productId })
        .where((review) => review.status.in([...APPROVED_REVIEW_STATUSES]))
        .aggregate((agg) => ({
          reviewCount: agg.count(),
          averageRating: agg.avg("rating"),
        }));
      const reviewCount = Number(aggregate?.reviewCount ?? 0);
      if (reviewCount <= 0) return;
      map.set(productId, {
        reviewCount,
        avgRating: Number(aggregate?.averageRating ?? 0),
      });
    }),
  );

  return map;
}

/**
 * Batch ratings for storefront product cards.
 * Always derives counts from approved reviews in the DB (not only cached product columns).
 */
export async function listProductCardRatings(input: {
  shopDomain: string;
  productIds?: string[];
  handles?: string[];
}): Promise<ProductCardRating[]> {
  const shop = await getShopByDomain(input.shopDomain);
  if (!shop || shop.uninstalledAt) {
    return [];
  }

  const db = getDb();
  const productIds = normalizeIds(input.productIds ?? []);
  const handles = normalizeHandles(input.handles ?? []);

  if (productIds.length === 0 && handles.length === 0) {
    return [];
  }

  let products =
    productIds.length > 0
      ? await db.orm.public.Product.where({ shopId: shop.id })
          .where((row) => row.shopifyProductId.in(productIds))
          .all()
      : [];

  if (handles.length > 0) {
    const byHandle = await db.orm.public.Product.where({ shopId: shop.id })
      .where((row) => row.handle.in(handles))
      .all();
    const seen = new Set(products.map((row) => row.id));
    for (const row of byHandle) {
      if (!seen.has(row.id)) {
        products.push(row);
        seen.add(row.id);
      }
    }
  }

  if (products.length === 0) {
    return [];
  }

  const live = await liveRatingsForProductIds(products.map((row) => row.id));

  // Persist corrected caches when stale so dashboard/metafields stay in sync.
  await Promise.all(
    products.map(async (product) => {
      const stats = live.get(product.id);
      if (!stats) {
        if ((product.reviewCount ?? 0) > 0 || product.avgRating != null) {
          await db.orm.public.Product.where({ id: product.id }).update({
            avgRating: null,
            reviewCount: 0,
          });
        }
        return;
      }
      const cachedCount = Number(product.reviewCount ?? 0);
      const cachedAvg = Number(product.avgRating ?? 0);
      if (
        cachedCount !== stats.reviewCount ||
        Math.abs(cachedAvg - stats.avgRating) > 0.01
      ) {
        await db.orm.public.Product.where({ id: product.id }).update({
          avgRating: stats.avgRating,
          reviewCount: stats.reviewCount,
        });
      }
    }),
  );

  return products
    .map((row) => {
      const stats = live.get(row.id);
      if (!stats || stats.reviewCount <= 0) return null;
      return {
        shopifyProductId: row.shopifyProductId,
        handle: row.handle,
        avgRating: stats.avgRating,
        reviewCount: stats.reviewCount,
      } satisfies ProductCardRating;
    })
    .filter((row): row is ProductCardRating => Boolean(row));
}
