import { config } from "dotenv";
import { getDb } from "../lib/prisma";
import { syncProductRatingMetafields } from "../services/reviews/ratings";
import { loadOfflineSessionByShopId } from "../services/shop/service";
import { createGraphqlClient } from "../lib/shopify/client";

config();

async function main() {
  const shopDomain = process.argv[2] || "test-lcoemihp.myshopify.com";
  const limit = Number(process.argv[3] || 20);
  const db = getDb();
  const shop = await db.orm.public.Shop.where({
    shopifyDomain: shopDomain,
  }).first();
  if (!shop) throw new Error(`Shop not found: ${shopDomain}`);

  const products = await db.orm.public.Product.where({ shopId: shop.id })
    .where((p) => p.reviewCount.gt(0))
    .orderBy((p) => p.reviewCount.desc())
    .limit(limit)
    .all();

  console.log(`Syncing ${products.length} products…`);
  for (const product of products) {
    if (!/^\d+$/.test(product.shopifyProductId)) {
      console.log("skip", product.shopifyProductId, product.handle);
      continue;
    }
    try {
      const stats = await syncProductRatingMetafields(product.id);
      console.log(
        "ok",
        product.handle,
        Number(stats.averageRating).toFixed(1),
        stats.reviewCount,
      );
    } catch (error) {
      console.log(
        "fail",
        product.handle,
        product.shopifyProductId,
        String(error).slice(0, 160),
      );
    }
  }

  // Verify standard metafield shape on one product
  const sample = products.find((p) => /^\d+$/.test(p.shopifyProductId));
  if (!sample) return;
  const session = await loadOfflineSessionByShopId(shop.id);
  if (!session) return;
  const client = createGraphqlClient(session);
  const res = await client.request(
    `#graphql
    query($id: ID!) {
      product(id: $id) {
        rating: metafield(namespace: "reviews", key: "rating") { type value }
        ratingCount: metafield(namespace: "reviews", key: "rating_count") { type value }
        count: metafield(namespace: "reviews", key: "count") { type value }
      }
    }`,
    { variables: { id: `gid://shopify/Product/${sample.shopifyProductId}` } },
  );
  console.log("verify", sample.handle, JSON.stringify(res.data?.product, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
