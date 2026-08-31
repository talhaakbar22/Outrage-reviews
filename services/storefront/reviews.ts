import { getDb } from "@/lib/prisma";

export type StorefrontReview = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  reviewerName: string | null;
  isVerifiedPurchase: boolean;
  publishedAt: string | null;
  createdAt: string;
  media: Array<{
    id: string;
    url: string;
    thumbnailUrl: string | null;
    type: string;
  }>;
};

export async function getShopByDomain(shopDomain: string) {
  const db = getDb();
  return db.orm.public.Shop.where({
    shopifyDomain: shopDomain,
  }).first();
}

export async function listPublishedReviewsForShopifyProduct(input: {
  shopId: string;
  shopifyProductId: string;
  limit?: number;
  offset?: number;
}) {
  const db = getDb();
  const product = await db.orm.public.Product.where({
    shopId: input.shopId,
    shopifyProductId: input.shopifyProductId,
  }).first();

  if (!product) {
    return {
      product: null,
      reviews: [] as StorefrontReview[],
      rating: null as number | null,
      count: 0,
      ratingBreakdown: null as Record<string, number> | null,
    };
  }

  const limit = Math.min(input.limit ?? 20, 50);
  const offset = input.offset ?? 0;

  const reviews = await db.orm.public.Review.where({
    shopId: input.shopId,
    productId: product.id,
    status: "published",
  })
    .include("media", (media) =>
      media
        .select("id", "url", "thumbnailUrl", "type", "sortOrder")
        .orderBy((item) => item.sortOrder.asc()),
    )
    .orderBy((review) => review.publishedAt.desc())
    .offset(offset)
    .limit(limit)
    .all();

  return {
    product: {
      id: product.id,
      title: product.title,
      handle: product.handle,
    },
    rating: product.avgRating,
    count: product.reviewCount,
    ratingBreakdown: (product.ratingBreakdown as Record<string, number> | null) ?? null,
    reviews: reviews.map(
      (review): StorefrontReview => ({
        id: review.id,
        rating: review.rating,
        title: review.title,
        body: review.body,
        reviewerName: review.reviewerName,
        isVerifiedPurchase: review.isVerifiedPurchase,
        publishedAt: review.publishedAt?.toISOString() ?? null,
        createdAt: review.createdAt.toISOString(),
        media: [...review.media]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((item) => ({
            id: item.id,
            url: item.url,
            thumbnailUrl: item.thumbnailUrl,
            type: item.type,
          })),
      }),
    ),
  };
}
