import { toIsoString } from "@/lib/prisma";
import type { DashboardReview } from "@/services/reviews/moderation";
import type { ReviewCardData } from "@/components/dashboard/review-moderation-card";

export function toReviewCardData(review: DashboardReview): ReviewCardData {
  return {
    id: review.id,
    rating: review.rating,
    title: review.title,
    body: review.body,
    status: review.status,
    reviewerName: review.reviewerName,
    product: { title: review.product.title },
    media: review.media.map((item) => ({
      id: item.id,
      url: item.url,
      thumbnailUrl: item.thumbnailUrl,
    })),
    createdAt: toIsoString(review.createdAt) ?? "",
  };
}
