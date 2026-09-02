import { getDb, nowInstant, toInstant } from "@/lib/prisma";

export type CreateImportedReviewInput = {
  shopId: string;
  productId: string;
  externalId: string;
  rating: number;
  title: string | null;
  body: string;
  reviewerName: string | null;
  reviewerEmail: string | null;
  isVerifiedPurchase: boolean;
  status: "published" | "pending" | "rejected";
  createdAt: Date;
  publishedAt: Date | null;
  merchantReply: string | null;
  merchantRepliedAt: Date | null;
  media: Array<{
    type: "image";
    url: string;
    sortOrder: number;
  }>;
};

export async function findReviewByExternalId(shopId: string, externalId: string) {
  const db = getDb();
  return db.orm.public.Review.where({ shopId, externalId }).first();
}

export async function createImportedReview(input: CreateImportedReviewInput) {
  const db = getDb();

  const review = await db.orm.public.Review.create({
    shopId: input.shopId,
    productId: input.productId,
    externalId: input.externalId,
    rating: input.rating,
    title: input.title,
    body: input.body,
    reviewerName: input.reviewerName,
    reviewerEmail: input.reviewerEmail,
    isVerifiedPurchase: input.isVerifiedPurchase,
    source: "import",
    status: input.status,
    publishedAt: input.publishedAt ? toInstant(input.publishedAt) : null,
    merchantReply: input.merchantReply,
    merchantRepliedAt: input.merchantRepliedAt
      ? toInstant(input.merchantRepliedAt)
      : null,
    createdAt: toInstant(input.createdAt),
  });

  if (!review) {
    throw new Error("Failed to create review");
  }

  for (const item of input.media) {
    await db.orm.public.ReviewMedia.create({
      reviewId: review.id,
      type: item.type,
      url: item.url,
      sortOrder: item.sortOrder,
    });
  }

  return review;
}

export {
  publishProductRatings,
  recalculateProductRatings,
  syncProductRatingMetafields,
} from "@/services/reviews/ratings";
