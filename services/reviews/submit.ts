import { getDb } from "@/lib/prisma";
import { enqueueMediaProcessing } from "@/lib/queue";
import {
  loadReviewRequestContext,
  markReviewRequestCompleted,
  ReviewRequestError,
} from "@/services/reviews/request";
import { publishProductRatings } from "@/services/reviews/ratings";
import { assertPendingUploadKey } from "@/services/media/keys";
import {
  buildPublicObjectUrl,
  headObject,
} from "@/services/media/object-storage";
import type { SubmitMediaReference } from "@/services/media/types";

export type SubmitReviewInput = {
  token: string;
  rating: number;
  title?: string | null;
  body: string;
  reviewerName?: string | null;
  media: SubmitMediaReference[];
};

export type SubmitReviewResult = {
  reviewId: string;
  status: "pending" | "published";
};

function resolveReviewStatus(input: {
  rating: number;
  autoPublishReviews: boolean;
  minRatingToPublish: number;
}): "pending" | "published" {
  if (input.autoPublishReviews && input.rating >= input.minRatingToPublish) {
    return "published";
  }
  return "pending";
}

export async function submitReviewFromToken(
  input: SubmitReviewInput,
): Promise<SubmitReviewResult> {
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    throw new ReviewRequestError("Rating must be between 1 and 5.", "invalid_token");
  }

  const body = input.body.trim();
  if (body.length < 1) {
    throw new ReviewRequestError("Please write a review before submitting.", "invalid_token");
  }

  const context = await loadReviewRequestContext(input.token);
  const db = getDb();

  const requestRecord = await db.orm.public.ReviewRequest.where({
    id: context.request.id,
  }).first();

  if (!requestRecord?.orderLineItemId || !requestRecord.orderId) {
    throw new ReviewRequestError(
      "This review link is not linked to a verified purchase.",
      "invalid_token",
    );
  }

  const settings = await db.orm.public.ShopSettings.where({
    shopId: context.shop.id,
  }).first();

  const status = resolveReviewStatus({
    rating: input.rating,
    autoPublishReviews: settings?.autoPublishReviews ?? false,
    minRatingToPublish: settings?.minRatingToPublish ?? 4,
  });

  const now = new Date();
  const reviewerName =
    input.reviewerName?.trim() ||
    context.customerName ||
    context.request.email.split("@")[0] ||
    "Customer";

  let review;
  try {
    review = await db.orm.public.Review.create({
      shopId: context.shop.id,
      productId: context.product.id,
      customerId: requestRecord.customerId,
      orderId: requestRecord.orderId,
      orderLineItemId: requestRecord.orderLineItemId,
      rating: input.rating,
      title: input.title?.trim() || null,
      body,
      reviewerName,
      reviewerEmail: context.request.email,
      isVerifiedPurchase: true,
      source: "email_request",
      status,
      publishedAt: status === "published" ? now : null,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      /unique|duplicate|orderLineItemId/i.test(error.message)
    ) {
      throw new ReviewRequestError(
        "A review has already been submitted for this purchase.",
        "duplicate_review",
      );
    }
    throw error;
  }

  if (!review) {
    throw new Error("Failed to create review");
  }

  for (const item of input.media) {
    assertPendingUploadKey(item.mediaKey, context.shop.id, context.request.id);

    try {
      await headObject(item.mediaKey);
    } catch {
      throw new ReviewRequestError(
        "One or more photos were not uploaded successfully. Please try again.",
        "invalid_token",
      );
    }

    const reviewMedia = await db.orm.public.ReviewMedia.create({
      reviewId: review.id,
      type: "image",
      url: buildPublicObjectUrl(item.mediaKey),
      sortOrder: item.sortOrder,
    });

    if (!reviewMedia) {
      throw new Error("Failed to create review media record");
    }

    await enqueueMediaProcessing({
      reviewMediaId: reviewMedia.id,
      pendingKey: item.mediaKey,
      shopId: context.shop.id,
      reviewId: review.id,
    });
  }

  await markReviewRequestCompleted(context.request.id);

  if (status === "published") {
    await publishProductRatings(context.product.id);
  }

  return {
    reviewId: review.id,
    status,
  };
}

export { ReviewRequestError };
