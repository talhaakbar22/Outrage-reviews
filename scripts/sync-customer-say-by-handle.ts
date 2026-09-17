import { config } from "dotenv";
import { getDb } from "../lib/prisma";
import { loadOfflineSessionByShopId } from "../services/shop/service";
import { updateProductRatingMetafields } from "../lib/shopify/metafields";
import { buildCustomerSayPayload } from "../services/reviews/customer-summary";
import { recalculateProductRatings } from "../services/reviews/ratings";

config();

async function main() {
  const shopDomain = process.argv[2] || "test-lcoemihp.myshopify.com";
  const handle =
    process.argv[3] || "silver-crucifix-cross-necklace-pendant";
  const db = getDb();
  const shop = await db.orm.public.Shop.where({
    shopifyDomain: shopDomain,
  }).first();
  if (!shop) throw new Error(`Shop not found: ${shopDomain}`);

  const session = await loadOfflineSessionByShopId(shop.id);
  if (!session) throw new Error("No offline session");

  const { createGraphqlClient } = await import("../lib/shopify/client");
  const client = createGraphqlClient(session);

  const lookup = await client.request(
    `#graphql
    query ProductByHandle($handle: String!) {
      productByHandle(handle: $handle) {
        id
        legacyResourceId
        title
        handle
        metafields(first: 15, namespace: "reviews") {
          nodes { key type value }
        }
      }
    }`,
    { variables: { handle } },
  );

  const remote = lookup.data?.productByHandle;
  console.log("remote", {
    id: remote?.id,
    legacyResourceId: remote?.legacyResourceId,
    title: remote?.title,
    metafields: remote?.metafields?.nodes,
  });
  if (!remote?.legacyResourceId) {
    throw new Error(`Shopify product not found for handle ${handle}`);
  }

  const local = await db.orm.public.Product.where({
    shopId: shop.id,
    handle,
  }).all();
  console.log(
    "local rows",
    local.map((p) => ({
      id: p.id,
      shopifyProductId: p.shopifyProductId,
      reviewCount: p.reviewCount,
    })),
  );

  // Prefer the local row that already has reviews; remapped to real Shopify id.
  let canonical:
    | (typeof local)[number]
    | null
    | undefined = local.find((p) => /^\d+$/.test(p.shopifyProductId));
  const withReviews = local.map(async (p) => {
    const count = await db.orm.public.Review.where({ productId: p.id })
      .where((r) => r.status.in(["published", "approved"]))
      .aggregate((agg) => ({ count: agg.count() }));
    return { product: p, count: Number(count?.count ?? 0) };
  });
  const scored = await Promise.all(withReviews);
  scored.sort((a, b) => b.count - a.count);
  const best = scored[0];
  if (!best || best.count <= 0) {
    throw new Error("No local reviews found for this handle");
  }

  const realId = String(remote.legacyResourceId);
  if (best.product.shopifyProductId !== realId) {
    // If another row already owns the real ID, move reviews onto it.
    const existingReal = local.find((p) => p.shopifyProductId === realId);
    if (!existingReal) {
      await db.orm.public.Product.where({ id: best.product.id }).update({
        shopifyProductId: realId,
        handle: remote.handle,
        title: remote.title,
      });
      console.log("Updated synthetic/wrong id to", realId);
      canonical =
        (await db.orm.public.Product.where({ id: best.product.id }).first()) ??
        best.product;
    } else if (existingReal.id !== best.product.id) {
      const { reassignReviewsToProduct } = await import(
        "../services/products/repository"
      );
      const moved = await reassignReviewsToProduct({
        fromProductId: best.product.id,
        toProductId: existingReal.id,
      });
      console.log("Reassigned reviews to real product row", { moved, realId });
      canonical = existingReal;
    } else {
      canonical = existingReal;
    }
  } else {
    canonical = best.product;
  }

  if (!canonical) throw new Error("Canonical product missing after remap");

  const ratings = await recalculateProductRatings(canonical.id);
  const payload = await buildCustomerSayPayload({
    shopId: shop.id,
    shopifyProductId: realId,
    includeReviews: true,
    reviewsLimit: 10,
    skipSummary: false,
  });

  await updateProductRatingMetafields(session, remote.id, {
    averageRating: ratings.averageRating,
    reviewCount: ratings.reviewCount,
    ratingBreakdown: ratings.ratingBreakdown,
    customerSay: {
      rating: payload.rating,
      count: payload.count,
      verifiedCount: payload.verifiedCount,
      summaryText: payload.summaryText,
      summarySourceCount: payload.summarySourceCount,
      summaryGeneratedAt: payload.summaryGeneratedAt,
      summaryMonthLabel: payload.summaryMonthLabel,
      highlights: payload.highlights,
      snippets: payload.snippets,
      reviews: payload.reviews,
      reviewsTotal: payload.reviewsTotal,
      hasMoreReviews: payload.hasMoreReviews,
    },
  });

  console.log("Synced", {
    localProductId: canonical.id,
    shopifyProductId: realId,
    averageRating: ratings.averageRating,
    reviewCount: ratings.reviewCount,
    customerSayCount: payload.count,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
