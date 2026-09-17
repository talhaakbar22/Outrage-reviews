import { getDb } from "@/lib/prisma";
import { getShopByDomain } from "@/services/storefront/reviews";
import { APPROVED_REVIEW_STATUSES } from "@/services/reviews/ai-summary";
import { resolveStorefrontProduct } from "@/services/products/repository";

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
 * Live DB aggregates + same-handle alias rollup. Resolves stale Shopify IDs
 * and matches handles case-insensitively so imported reviews show on every card.
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

  // Case-insensitive handle match: load reviewed products and filter in memory.
  // Exact `.in(handles)` misses mixed-case import handles.
  if (handles.length > 0) {
    const handleSet = new Set(handles);
    const candidates = await db.orm.public.Product.where({
      shopId: shop.id,
    })
      .where((row) => row.reviewCount.gt(0))
      .all();
    const seen = new Set(products.map((row) => row.id));
    for (const row of candidates) {
      const key = (row.handle || "").trim().toLowerCase();
      if (!key || !handleSet.has(key) || seen.has(row.id)) continue;
      products.push(row);
      seen.add(row.id);
    }

    // Also try exact match for products with reviewCount cache still at 0
    // but live approved reviews (stale cache).
    const exact = await db.orm.public.Product.where({ shopId: shop.id })
      .where((row) => row.handle.in(handles))
      .all();
    for (const row of exact) {
      if (!seen.has(row.id)) {
        products.push(row);
        seen.add(row.id);
      }
    }
  }

  // Heal missing numeric IDs (stale import ids / remapped catalog).
  const foundIds = new Set(
    products
      .map((row) => row.shopifyProductId.replace(/\D/g, "") || row.shopifyProductId)
      .filter(Boolean),
  );
  const missingIds = productIds.filter((id) => !foundIds.has(id)).slice(0, 40);
  if (missingIds.length > 0) {
    const resolved = await Promise.all(
      missingIds.map(async (id) => {
        try {
          return await resolveStorefrontProduct(shop.id, id);
        } catch {
          return null;
        }
      }),
    );
    const seen = new Set(products.map((row) => row.id));
    for (const row of resolved) {
      if (!row || seen.has(row.id)) continue;
      products.push(row);
      seen.add(row.id);
    }
  }

  // Pull same-handle aliases (any casing) so csv-/loox- reviews count.
  const handleKeys = [
    ...new Set(
      products
        .map((row) => (row.handle || "").trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  if (handleKeys.length > 0) {
    const handleSet = new Set(handleKeys);
    const reviewed = await db.orm.public.Product.where({ shopId: shop.id })
      .where((row) => row.reviewCount.gt(0))
      .all();
    const seen = new Set(products.map((row) => row.id));
    for (const row of reviewed) {
      const key = (row.handle || "").trim().toLowerCase();
      if (!key || !handleSet.has(key) || seen.has(row.id)) continue;
      products.push(row);
      seen.add(row.id);
    }
  }

  if (products.length === 0) {
    return [];
  }

  const live = await liveRatingsForProductIds(products.map((row) => row.id));

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
      handle,
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
          existing.handle = handle;
        }
      }
    } else {
      byId.set(product.shopifyProductId, entry);
    }
  }

  // Prefer returning the live catalog id when the request asked for it.
  for (const id of productIds) {
    for (const entry of byHandle.values()) {
      if (entry.shopifyProductId === id) continue;
      // If this handle's reviews are the ones for a requested live id that we
      // resolved onto a product row, prefer the requested id as the public key.
      const matchingProduct = products.find(
        (row) =>
          (row.shopifyProductId.replace(/\D/g, "") || row.shopifyProductId) ===
            id &&
          (row.handle || "").trim().toLowerCase() ===
            (entry.handle || "").trim().toLowerCase(),
      );
      if (matchingProduct && /^\d+$/.test(id)) {
        entry.shopifyProductId = id;
      }
    }
  }

  const rolled = [...byHandle.values(), ...byId.values()];

  await Promise.all(
    products.map(async (product) => {
      if (!/^\d+$/.test(product.shopifyProductId)) return;
      const handle = (product.handle || "").trim().toLowerCase();
      const stats = handle
        ? byHandle.get(handle)
        : byId.get(product.shopifyProductId);
      if (!stats) return;
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
        return productIds.includes(
          row.shopifyProductId.replace(/\D/g, "") || row.shopifyProductId,
        );
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
