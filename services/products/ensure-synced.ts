import {
  fetchProductByShopifyId,
  mapShopifyProductStatus,
  parseProductRatings,
  shopifyGidToId,
} from "@/lib/shopify/products";
import { getDb, nowInstant } from "@/lib/prisma";
import { upsertProduct } from "@/services/products/repository";
import { loadOfflineSessionByShopId } from "@/services/shop/service";

export async function ensureProductSynced(
  shopId: string,
  shopifyProductId: string,
) {
  const db = getDb();
  const existing = await db.orm.public.Product.where({
    shopId,
    shopifyProductId,
  }).first();

  if (existing) {
    return existing;
  }

  const session = await loadOfflineSessionByShopId(shopId);
  if (!session) {
    return null;
  }

  const shopifyProduct = await fetchProductByShopifyId(session, shopifyProductId);
  if (!shopifyProduct) {
    return null;
  }

  const ratings = parseProductRatings(shopifyProduct);

  return upsertProduct(shopId, {
    shopifyProductId: shopifyGidToId(shopifyProduct.id),
    title: shopifyProduct.title,
    handle: shopifyProduct.handle,
    imageUrl: shopifyProduct.featuredImage?.url ?? null,
    status: mapShopifyProductStatus(shopifyProduct.status),
    avgRating: ratings.avgRating,
    reviewCount: ratings.reviewCount,
    lastSyncedAt: nowInstant(),
  });
}
