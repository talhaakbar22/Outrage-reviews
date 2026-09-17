import { getDb, toInstant, type DbInstant } from "@/lib/prisma";

export type ProductUpsertInput = {
  shopifyProductId: string;
  title: string;
  handle: string | null;
  imageUrl: string | null;
  status: "active" | "archived" | "draft";
  lastSyncedAt: Date | DbInstant;
  avgRating?: number | null;
  reviewCount?: number;
};

export async function upsertProduct(shopId: string, input: ProductUpsertInput) {
  const db = getDb();
  const existing = await db.orm.public.Product.where({
    shopId,
    shopifyProductId: input.shopifyProductId,
  }).first();

  const payload = {
    title: input.title,
    handle: input.handle,
    imageUrl: input.imageUrl,
    status: input.status,
    lastSyncedAt: toInstant(input.lastSyncedAt),
    avgRating:
      input.avgRating !== undefined
        ? input.avgRating
        : (existing?.avgRating ?? null),
    reviewCount:
      input.reviewCount !== undefined
        ? input.reviewCount
        : (existing?.reviewCount ?? 0),
  };

  if (existing) {
    return db.orm.public.Product.where({ id: existing.id }).update(payload);
  }

  return db.orm.public.Product.create({
    shopId,
    shopifyProductId: input.shopifyProductId,
    ...payload,
    avgRating: input.avgRating ?? null,
    reviewCount: input.reviewCount ?? 0,
  });
}

export async function resolveProductId(
  shopId: string,
  shopifyProductId: string | null,
) {
  if (!shopifyProductId) {
    return null;
  }

  const db = getDb();
  const product = await db.orm.public.Product.where({
    shopId,
    shopifyProductId,
  }).first();

  return product?.id ?? null;
}

export async function resolveProductByHandle(shopId: string, handle: string | null) {
  if (!handle) {
    return null;
  }

  const normalized = handle.trim();
  if (!normalized) {
    return null;
  }

  const db = getDb();
  const product = await db.orm.public.Product.where({
    shopId,
    handle: normalized,
  }).first();

  return product?.id ?? null;
}

export async function resolveProductForLooxRow(
  shopId: string,
  input: { productHandle: string | null; shopifyProductId: string | null },
) {
  // Prefer exact Shopify product ID when present (handles can be renamed in Loox).
  const byId = await resolveProductId(shopId, input.shopifyProductId);
  if (byId) {
    return byId;
  }

  return resolveProductByHandle(shopId, input.productHandle);
}

export async function getProductById(productId: string) {
  const db = getDb();
  return db.orm.public.Product.where({ id: productId }).first();
}

function isSyntheticShopifyId(shopifyProductId: string | null | undefined) {
  const value = String(shopifyProductId || "");
  return (
    value.startsWith("csv-") ||
    value.startsWith("loox-") ||
    value.startsWith("OR") ||
    !/^\d+$/.test(value)
  );
}

async function countApprovedReviews(productId: string) {
  const db = getDb();
  const { APPROVED_REVIEW_STATUSES } = await import(
    "@/services/reviews/ai-summary"
  );
  const result = await db.orm.public.Review.where({ productId })
    .where((review) => review.status.in([...APPROVED_REVIEW_STATUSES]))
    .aggregate((agg) => ({ count: agg.count() }));
  return Number(result?.count ?? 0);
}

/**
 * Move reviews (and media via cascade/FK) from alias product rows onto the
 * canonical Shopify product so storefront widgets and metafields stay in sync.
 */
export async function reassignReviewsToProduct(input: {
  fromProductId: string;
  toProductId: string;
}) {
  if (input.fromProductId === input.toProductId) return 0;
  const db = getDb();
  const reviews = await db.orm.public.Review.where({
    productId: input.fromProductId,
  }).all();

  let moved = 0;
  for (const review of reviews) {
    await db.orm.public.Review.where({ id: review.id }).update({
      productId: input.toProductId,
    });
    moved += 1;
  }

  if (moved > 0) {
    const { recalculateProductRatings, publishProductRatings } = await import(
      "@/services/reviews/ratings"
    );
    await recalculateProductRatings(input.fromProductId);
    await recalculateProductRatings(input.toProductId);
    // Keep Shopify metafields in sync without blocking the storefront request.
    void publishProductRatings(input.toProductId).catch((error) => {
      console.error("[products] publish after reassign failed:", error);
    });
    void publishProductRatings(input.fromProductId).catch((error) => {
      console.error("[products] publish after reassign failed:", error);
    });
  }

  return moved;
}

/**
 * Resolve the product the storefront should use for reviews:
 * 1) exact Shopify product id
 * 2) sync from Shopify if missing
 * 3) if that row has no approved reviews, adopt reviews from same-handle aliases
 * 4) if the numeric id is stale, resolve the live Shopify product by id → handle
 */
export async function resolveStorefrontProduct(
  shopId: string,
  shopifyProductId: string,
) {
  const db = getDb();
  const normalizedId =
    shopifyProductId.replace(/\D/g, "") || shopifyProductId.trim();

  let product = await db.orm.public.Product.where({
    shopId,
    shopifyProductId: normalizedId,
  }).first();

  if (!product) {
    const { ensureProductSynced } = await import(
      "@/services/products/ensure-synced"
    );
    product = await ensureProductSynced(shopId, normalizedId);
  }

  // Stale local IDs (imports / old stores) often keep reviews under a handle while
  // the live Shopify catalog uses a different numeric product id.
  if (!product || (await countApprovedReviews(product.id)) <= 0) {
    try {
      const { loadOfflineSessionByShopId } = await import(
        "@/services/shop/service"
      );
      const { fetchProductByShopifyId, shopifyGidToId } = await import(
        "@/lib/shopify/products"
      );
      const session = await loadOfflineSessionByShopId(shopId);
      if (session) {
        const remote = await fetchProductByShopifyId(session, normalizedId);
        if (remote?.handle) {
          const realId = shopifyGidToId(remote.id);
          const byHandle = await db.orm.public.Product.where({
            shopId,
            handle: remote.handle,
          }).all();

          let best = product;
          let bestCount = product
            ? await countApprovedReviews(product.id)
            : 0;
          for (const row of byHandle) {
            const count = await countApprovedReviews(row.id);
            if (count > bestCount) {
              best = row;
              bestCount = count;
            }
          }

          if (best && bestCount > 0) {
            if (best.shopifyProductId !== realId) {
              const existingReal = byHandle.find(
                (row) => row.shopifyProductId === realId,
              );
              if (existingReal && existingReal.id !== best.id) {
                await reassignReviewsToProduct({
                  fromProductId: best.id,
                  toProductId: existingReal.id,
                });
                product =
                  (await db.orm.public.Product.where({
                    id: existingReal.id,
                  }).first()) ?? existingReal;
              } else {
                await db.orm.public.Product.where({ id: best.id }).update({
                  shopifyProductId: realId,
                  handle: remote.handle,
                  title: remote.title,
                });
                product =
                  (await db.orm.public.Product.where({
                    id: best.id,
                  }).first()) ?? best;
              }
            } else {
              product = best;
            }
          } else if (!product && remote) {
            const { upsertProduct } = await import(
              "@/services/products/repository"
            );
            const { mapShopifyProductStatus, parseProductRatings } =
              await import("@/lib/shopify/products");
            const { nowInstant } = await import("@/lib/prisma");
            const ratings = parseProductRatings(remote);
            product = await upsertProduct(shopId, {
              shopifyProductId: realId,
              title: remote.title,
              handle: remote.handle,
              imageUrl: remote.featuredImage?.url ?? null,
              status: mapShopifyProductStatus(remote.status),
              avgRating: ratings.avgRating,
              reviewCount: ratings.reviewCount,
              lastSyncedAt: nowInstant(),
            });
          }
        }
      }
    } catch (error) {
      console.error("[products] resolveStorefrontProduct remote lookup:", error);
    }
  }

  if (!product) {
    return null;
  }

  const handle = product.handle?.trim();
  if (!handle) {
    return product;
  }

  const aliases = await db.orm.public.Product.where({
    shopId,
    handle,
  }).all();

  // Move every same-handle alias's reviews onto the real Shopify product.
  if (!isSyntheticShopifyId(product.shopifyProductId)) {
    let movedTotal = 0;
    for (const alias of aliases) {
      if (alias.id === product.id) continue;
      const count = await countApprovedReviews(alias.id);
      if (count <= 0) continue;
      movedTotal += await reassignReviewsToProduct({
        fromProductId: alias.id,
        toProductId: product.id,
      });
    }
    if (movedTotal > 0) {
      const refreshed = await db.orm.public.Product.where({
        id: product.id,
      }).first();
      return refreshed ?? product;
    }
    return product;
  }

  // Synthetic catalog row: prefer another same-handle product that already has reviews.
  let bestAlias: (typeof aliases)[number] | null = null;
  let bestCount = await countApprovedReviews(product.id);
  for (const alias of aliases) {
    if (alias.id === product.id) continue;
    const count = await countApprovedReviews(alias.id);
    if (count > bestCount) {
      bestAlias = alias;
      bestCount = count;
    }
  }

  return bestAlias ?? product;
}
