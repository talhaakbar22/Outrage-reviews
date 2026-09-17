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
 * Same-handle alias products (csv-/loox- imports) are rolled up onto the numeric Shopify id.
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

  // Pull same-handle aliases so imported reviews attached to csv-/loox- rows count.
  const handleKeys = [
    ...new Set(
      products
        .map((row) => (row.handle || "").trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  if (handleKeys.length > 0) {
    const aliases = await db.orm.public.Product.where({ shopId: shop.id })
      .where((row) => row.handle.in(handleKeys))
      .all();
    const seen = new Set(products.map((row) => row.id));
    for (const row of aliases) {
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

  // Roll up by handle, preferring a numeric Shopify product id as the public key.
  type Rollup = {
    shopifyProductId: string;
    handle: string | null;
    avgRating: number;
    reviewCount: number;
    ratingSum: number;
  };
  const byHandle = new Map<string, Rollup>();
  const byId = new Map<string, Rollup>();

  for (const product of products) {
    const stats = live.get(product.id);
    if (!stats || stats.reviewCount <= 0) continue;

    const handle = (product.handle || "").trim().toLowerCase() || null;
    const isNumeric = /^\d+$/.test(product.shopifyProductId);
    const entry: Rollup = {
      shopifyProductId: product.shopifyProductId,
      handle: product.handle,
      avgRating: stats.avgRating,
      reviewCount: stats.reviewCount,
      ratingSum: stats.avgRating * stats.reviewCount,
    };

    if (handle) {
      const existing = byHandle.get(handle);
      if (!existing) {
        byHandle.set(handle, entry);
      } else {
        existing.ratingSum += entry.ratingSum;
        existing.reviewCount += entry.reviewCount;
        existing.avgRating = existing.ratingSum / existing.reviewCount;
        if (isNumeric) {
          existing.shopifyProductId = product.shopifyProductId;
          existing.handle = product.handle;
        }
      }
    } else {
      byId.set(product.shopifyProductId, entry);
    }
  }

  const rolled = [...byHandle.values(), ...byId.values()];

  // Persist corrected caches on numeric Shopify products when we can map them.
  await Promise.all(
    products.map(async (product) => {
      if (!/^\d+$/.test(product.shopifyProductId)) return;
      const handle = (product.handle || "").trim().toLowerCase();
      const stats = handle
        ? byHandle.get(handle)
        : byId.get(product.shopifyProductId);
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

  return rolled
    .filter((row) => {
      if (productIds.length > 0 && handles.length === 0) {
        return productIds.includes(row.shopifyProductId.replace(/\D/g, "") || row.shopifyProductId);
      }
      if (handles.length > 0 && productIds.length === 0) {
        return handles.includes((row.handle || "").trim().toLowerCase());
      }
      const idMatch = productIds.includes(
        row.shopifyProductId.replace(/\D/g, "") || row.shopifyProductId,
      );
      const handleMatch = handles.includes(
        (row.handle || "").trim().toLowerCase(),
      );
      return idMatch || handleMatch;
    })
    .map((row) => ({
      shopifyProductId: row.shopifyProductId,
      handle: row.handle,
      avgRating: row.avgRating,
      reviewCount: row.reviewCount,
    }));
}
