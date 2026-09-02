import { getDb } from "@/lib/prisma";
import { enqueueMediaProcessing } from "@/lib/queue";
import { assertPendingUploadKey } from "@/services/media/keys";
import {
  buildPublicObjectUrl,
  headObject,
} from "@/services/media/object-storage";
import type { SubmitMediaReference } from "@/services/media/types";
import { publishProductRatings } from "@/services/reviews/ratings";
import { getShopByDomain } from "@/services/storefront/reviews";

export type WidgetMediaReference = SubmitMediaReference & {
  mediaType?: "image" | "video";
};

export type SubmitWidgetReviewInput = {
  shopDomain: string;
  shopifyProductId: string;
  uploadSessionId: string;
  rating: number;
  body: string;
  firstName: string;
  lastName?: string | null;
  email: string;
  media: WidgetMediaReference[];
};

export class WidgetReviewError extends Error {
  code: string;

  constructor(message: string, code = "invalid_request") {
    super(message);
    this.name = "WidgetReviewError";
    this.code = code;
  }
}

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

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function buildReviewerName(firstName: string, lastName?: string | null) {
  const parts = [firstName.trim(), lastName?.trim()].filter(Boolean);
  return parts.join(" ") || firstName.trim() || "Customer";
}

export async function submitReviewFromWidget(input: SubmitWidgetReviewInput) {
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    throw new WidgetReviewError("Rating must be between 1 and 5.", "invalid_rating");
  }

  const body = input.body.trim();
  if (body.length < 1) {
    throw new WidgetReviewError("Please write a review before submitting.", "invalid_body");
  }

  const firstName = input.firstName.trim();
  if (!firstName) {
    throw new WidgetReviewError("First name is required.", "invalid_name");
  }

  const email = normalizeEmail(input.email);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new WidgetReviewError("A valid email address is required.", "invalid_email");
  }

  const uploadSessionId = input.uploadSessionId.trim();
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(uploadSessionId)) {
    throw new WidgetReviewError("Invalid upload session.", "invalid_session");
  }

  const shop = await getShopByDomain(input.shopDomain);
  if (!shop || shop.uninstalledAt) {
    throw new WidgetReviewError("Shop not found.", "shop_not_found");
  }

  const db = getDb();
  const settings = await db.orm.public.ShopSettings.where({
    shopId: shop.id,
  }).first();

  if (settings && !settings.widgetEnabled) {
    throw new WidgetReviewError(
      "Review collection is disabled for this store.",
      "widget_disabled",
    );
  }

  const shopifyProductId =
    input.shopifyProductId.replace(/\D/g, "") || input.shopifyProductId;

  const product = await db.orm.public.Product.where({
    shopId: shop.id,
    shopifyProductId,
  }).first();

  if (!product) {
    throw new WidgetReviewError("Product not found.", "product_not_found");
  }

  const status = resolveReviewStatus({
    rating: input.rating,
    autoPublishReviews: settings?.autoPublishReviews ?? false,
    minRatingToPublish: settings?.minRatingToPublish ?? 4,
  });

  const now = new Date();
  const reviewerName = buildReviewerName(firstName, input.lastName);

  const review = await db.orm.public.Review.create({
    shopId: shop.id,
    productId: product.id,
    rating: input.rating,
    body,
    reviewerName,
    reviewerEmail: email,
    isVerifiedPurchase: false,
    source: "widget",
    status,
    publishedAt: status === "published" ? now : null,
  });

  if (!review) {
    throw new Error("Failed to create review");
  }

  for (const item of input.media) {
    assertPendingUploadKey(item.mediaKey, shop.id, uploadSessionId);

    try {
      await headObject(item.mediaKey);
    } catch {
      throw new WidgetReviewError(
        "One or more files were not uploaded successfully. Please try again.",
        "invalid_media",
      );
    }

    const mediaType = item.mediaType === "video" ? "video" : "image";

    if (mediaType === "video") {
      await db.orm.public.ReviewMedia.create({
        reviewId: review.id,
        type: "video",
        url: buildPublicObjectUrl(item.mediaKey),
        sortOrder: item.sortOrder,
      });
      continue;
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
      shopId: shop.id,
      reviewId: review.id,
    });
  }

  if (status === "published") {
    await publishProductRatings(product.id);
  }

  return {
    reviewId: review.id,
    status,
    message:
      status === "published"
        ? "Thank you! Your review is now live."
        : "Thank you! Your review has been submitted for approval.",
  };
}
