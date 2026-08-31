import { getDb } from "@/lib/prisma";
import { publishProductRatings } from "@/services/reviews/ratings";

export type ReviewListFilters = {
  shopId: string;
  status?: "pending" | "published" | "rejected" | "approved" | "spam" | "all";
  rating?: number;
  hasMedia?: boolean;
  productId?: string;
  search?: string;
  sort?: "newest" | "oldest" | "highest" | "lowest";
  limit?: number;
  offset?: number;
};

export type DashboardReview = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  status: string;
  reviewerName: string | null;
  reviewerEmail: string | null;
  isVerifiedPurchase: boolean;
  source: string;
  merchantReply: string | null;
  merchantRepliedAt: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
  product: {
    id: string;
    title: string;
    imageUrl: string | null;
    handle: string | null;
    shopifyProductId: string;
  };
  media: Array<{
    id: string;
    url: string;
    thumbnailUrl: string | null;
    type: string;
    sortOrder: number;
  }>;
  replies: Array<{
    id: string;
    body: string;
    authorName: string | null;
    publishedAt: Date;
  }>;
};

export type ManageReviewsResult = {
  reviews: DashboardReview[];
  total: number;
  averageRating: number;
  pendingCount: number;
  publishedCount: number;
  rejectedCount: number;
};

function mapReview(row: {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  status: string;
  reviewerName: string | null;
  reviewerEmail: string | null;
  isVerifiedPurchase: boolean;
  source: string;
  merchantReply: string | null;
  merchantRepliedAt: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
  product: {
    id: string;
    title: string;
    imageUrl: string | null;
    handle: string | null;
    shopifyProductId: string;
  };
  media: Array<{
    id: string;
    url: string;
    thumbnailUrl: string | null;
    type: string;
    sortOrder: number;
  }>;
  replies: Array<{
    id: string;
    body: string;
    authorName: string | null;
    publishedAt: Date;
  }>;
}): DashboardReview {
  return {
    ...row,
    media: [...row.media].sort((a, b) => a.sortOrder - b.sortOrder),
    replies: [...row.replies].sort(
      (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime(),
    ),
  };
}

function matchesSearch(review: DashboardReview, search: string) {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  return [
    review.reviewerName,
    review.reviewerEmail,
    review.title,
    review.body,
    review.product.title,
    review.merchantReply,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(q));
}

function sourceLabel(source: string) {
  switch (source) {
    case "email_request":
      return "Via review request email";
    case "import":
      return "Imported";
    case "widget":
      return "Via storefront widget";
    case "api":
      return "Via API";
    default:
      return "Native";
  }
}

export { sourceLabel };

async function fetchReviewRows(filters: ReviewListFilters) {
  const db = getDb();
  let query = db.orm.public.Review.where({ shopId: filters.shopId });

  if (filters.status && filters.status !== "all") {
    query = query.where({ status: filters.status });
  }

  if (filters.rating) {
    query = query.where({ rating: filters.rating });
  }

  if (filters.productId) {
    query = query.where({ productId: filters.productId });
  }

  const sort = filters.sort ?? "newest";
  const ordered =
    sort === "oldest"
      ? query.orderBy((review) => review.createdAt.asc())
      : sort === "highest"
        ? query.orderBy([
            (review) => review.rating.desc(),
            (review) => review.createdAt.desc(),
          ])
        : sort === "lowest"
          ? query.orderBy([
              (review) => review.rating.asc(),
              (review) => review.createdAt.desc(),
            ])
          : query.orderBy((review) => review.createdAt.desc());

  // When searching, pull a wider window then filter in memory.
  const searching = Boolean(filters.search?.trim());
  const fetchLimit = searching ? 500 : (filters.limit ?? 50);
  const fetchOffset = searching ? 0 : (filters.offset ?? 0);

  const rows = await ordered
    .include("product", (product) =>
      product.select("id", "title", "imageUrl", "handle", "shopifyProductId"),
    )
    .include("media", (media) =>
      media
        .select("id", "url", "thumbnailUrl", "type", "sortOrder")
        .orderBy((item) => item.sortOrder.asc()),
    )
    .include("replies", (replies) =>
      replies
        .select("id", "body", "authorName", "publishedAt")
        .orderBy((item) => item.publishedAt.desc()),
    )
    .offset(fetchOffset)
    .limit(fetchLimit)
    .all();

  return rows.map(mapReview);
}

export async function listDashboardReviews(
  filters: ReviewListFilters,
): Promise<DashboardReview[]> {
  const result = await listManageReviews(filters);
  return result.reviews;
}

export async function listManageReviews(
  filters: ReviewListFilters,
): Promise<ManageReviewsResult> {
  const db = getDb();
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  const [mapped, totalStats, publishedStats, pendingStats, rejectedStats] =
    await Promise.all([
      fetchReviewRows(filters),
      db.orm.public.Review.where({ shopId: filters.shopId }).aggregate((agg) => ({
        count: agg.count(),
        averageRating: agg.avg("rating"),
      })),
      db.orm.public.Review.where({
        shopId: filters.shopId,
        status: "published",
      }).aggregate((agg) => ({
        count: agg.count(),
        averageRating: agg.avg("rating"),
      })),
      db.orm.public.Review.where({
        shopId: filters.shopId,
        status: "pending",
      }).aggregate((agg) => ({ count: agg.count() })),
      db.orm.public.Review.where({
        shopId: filters.shopId,
        status: "rejected",
      }).aggregate((agg) => ({ count: agg.count() })),
    ]);

  let filtered = mapped;
  if (filters.hasMedia) {
    filtered = filtered.filter((review) => review.media.length > 0);
  }
  if (filters.search?.trim()) {
    filtered = filtered.filter((review) =>
      matchesSearch(review, filters.search!),
    );
  }

  const needsClientPaging =
    Boolean(filters.search?.trim()) || Boolean(filters.hasMedia);
  const page = needsClientPaging
    ? filtered.slice(offset, offset + limit)
    : filtered;

  let filteredTotal = filtered.length;
  if (!needsClientPaging) {
    if (filters.status === "pending") filteredTotal = pendingStats?.count ?? filtered.length;
    else if (filters.status === "published")
      filteredTotal = publishedStats?.count ?? filtered.length;
    else if (filters.status === "rejected")
      filteredTotal = rejectedStats?.count ?? filtered.length;
    else if (filters.rating || filters.productId)
      filteredTotal = filtered.length;
    else filteredTotal = totalStats?.count ?? filtered.length;
  }

  return {
    reviews: page,
    total: filteredTotal,
    averageRating: Number(publishedStats?.averageRating ?? totalStats?.averageRating ?? 0),
    pendingCount: pendingStats?.count ?? 0,
    publishedCount: publishedStats?.count ?? 0,
    rejectedCount: rejectedStats?.count ?? 0,
  };
}

export async function getDashboardReview(
  shopId: string,
  reviewId: string,
): Promise<DashboardReview | null> {
  const db = getDb();
  const row = await db.orm.public.Review.where({ id: reviewId, shopId })
    .include("product", (product) =>
      product.select("id", "title", "imageUrl", "handle", "shopifyProductId"),
    )
    .include("media", (media) =>
      media
        .select("id", "url", "thumbnailUrl", "type", "sortOrder")
        .orderBy((item) => item.sortOrder.asc()),
    )
    .include("replies", (replies) =>
      replies
        .select("id", "body", "authorName", "publishedAt")
        .orderBy((item) => item.publishedAt.desc()),
    )
    .first();

  return row ? mapReview(row) : null;
}

export async function getDashboardStats(shopId: string) {
  const db = getDb();

  const [publishedStats, pendingStats, totalStats, recent] = await Promise.all([
    db.orm.public.Review.where({ shopId, status: "published" }).aggregate(
      (agg) => ({
        count: agg.count(),
        averageRating: agg.avg("rating"),
      }),
    ),
    db.orm.public.Review.where({ shopId, status: "pending" }).aggregate(
      (agg) => ({ count: agg.count() }),
    ),
    db.orm.public.Review.where({ shopId }).aggregate((agg) => ({
      count: agg.count(),
    })),
    listDashboardReviews({ shopId, limit: 8 }),
  ]);

  const photoReviews = recent.filter((review) => review.media.length > 0).length;
  const mediaSample = await listDashboardReviews({
    shopId,
    hasMedia: true,
    limit: 1000,
  });

  return {
    averageRating: Number(publishedStats?.averageRating ?? 0),
    totalReviews: totalStats?.count ?? 0,
    publishedReviews: publishedStats?.count ?? 0,
    photoReviews: mediaSample.length,
    pendingReviews: pendingStats?.count ?? 0,
    recentReviews: recent,
    recentPhotoSampleSize: photoReviews,
  };
}

export async function setReviewStatus(
  shopId: string,
  reviewId: string,
  status: "published" | "pending" | "rejected",
) {
  if (status === "published") {
    return approveReview(shopId, reviewId);
  }
  if (status === "rejected") {
    return rejectReview(shopId, reviewId);
  }

  const db = getDb();
  const review = await db.orm.public.Review.where({ id: reviewId, shopId }).first();
  if (!review) {
    throw new Error("Review not found");
  }

  const wasPublished = review.status === "published";
  const updated = await db.orm.public.Review.where({ id: reviewId }).update({
    status: "pending",
    publishedAt: null,
  });

  if (wasPublished) {
    await publishProductRatings(review.productId);
  }

  return updated;
}

export async function approveReview(shopId: string, reviewId: string) {
  const db = getDb();
  const review = await db.orm.public.Review.where({ id: reviewId, shopId }).first();
  if (!review) {
    throw new Error("Review not found");
  }

  const updated = await db.orm.public.Review.where({ id: reviewId }).update({
    status: "published",
    publishedAt: review.publishedAt ?? new Date(),
  });

  await publishProductRatings(review.productId);

  return updated;
}

export async function rejectReview(shopId: string, reviewId: string) {
  const db = getDb();
  const review = await db.orm.public.Review.where({ id: reviewId, shopId }).first();
  if (!review) {
    throw new Error("Review not found");
  }

  const wasPublished = review.status === "published";
  const updated = await db.orm.public.Review.where({ id: reviewId }).update({
    status: "rejected",
    publishedAt: null,
  });

  if (wasPublished) {
    await publishProductRatings(review.productId);
  }

  return updated;
}

export async function bulkSetReviewStatus(input: {
  shopId: string;
  reviewIds: string[];
  status: "published" | "pending" | "rejected";
}) {
  const results = [];
  for (const reviewId of input.reviewIds) {
    results.push(await setReviewStatus(input.shopId, reviewId, input.status));
  }
  return results;
}

export async function replyToReview(input: {
  shopId: string;
  reviewId: string;
  body: string;
  authorName?: string | null;
}) {
  const body = input.body.trim();
  if (!body) {
    throw new Error("Reply cannot be empty");
  }

  const db = getDb();
  const review = await db.orm.public.Review.where({
    id: input.reviewId,
    shopId: input.shopId,
  }).first();

  if (!review) {
    throw new Error("Review not found");
  }

  const now = new Date();
  const authorName = input.authorName?.trim() || "Store team";

  await db.orm.public.ReviewReply.create({
    reviewId: review.id,
    body,
    authorName,
    publishedAt: now,
  });

  await db.orm.public.Review.where({ id: review.id }).update({
    merchantReply: body,
    merchantRepliedAt: now,
  });

  return getDashboardReview(input.shopId, review.id);
}

export function suggestReviewReply(review: {
  rating: number;
  reviewerName: string | null;
  productTitle: string;
  body: string | null;
}) {
  const name = review.reviewerName?.split(" ")[0] || "there";
  const product = review.productTitle;

  if (review.rating >= 4) {
    return `Hi ${name}, thank you so much for your kind words about the ${product}! We're thrilled you're happy with your purchase.`;
  }
  if (review.rating === 3) {
    return `Hi ${name}, thank you for sharing your experience with the ${product}. We'd love to learn more about how we can make things better for you.`;
  }
  return `Hi ${name}, thank you for your feedback on the ${product}. We're sorry this didn't fully meet your expectations — please reply to this message and our team will help.`;
}
