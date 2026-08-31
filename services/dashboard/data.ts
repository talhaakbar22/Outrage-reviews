import { getDb } from "@/lib/prisma";

export type ShopSettingsInput = {
  autoPublishReviews?: boolean;
  minRatingToPublish?: number;
  requestDelayDays?: number;
  reminderDelayDays?: number;
  emailEnabled?: boolean;
  widgetEnabled?: boolean;
};

export async function getShopSettings(shopId: string) {
  const db = getDb();
  let settings = await db.orm.public.ShopSettings.where({ shopId }).first();

  if (!settings) {
    settings = await db.orm.public.ShopSettings.create({ shopId });
  }

  if (!settings) {
    throw new Error("Failed to load shop settings");
  }

  return settings;
}

export async function updateShopSettings(shopId: string, input: ShopSettingsInput) {
  const db = getDb();
  const existing = await getShopSettings(shopId);

  const patch: Record<string, unknown> = {};

  if (typeof input.autoPublishReviews === "boolean") {
    patch.autoPublishReviews = input.autoPublishReviews;
  }
  if (
    typeof input.minRatingToPublish === "number" &&
    input.minRatingToPublish >= 1 &&
    input.minRatingToPublish <= 5
  ) {
    patch.minRatingToPublish = input.minRatingToPublish;
  }
  if (
    typeof input.requestDelayDays === "number" &&
    input.requestDelayDays >= 0 &&
    input.requestDelayDays <= 90
  ) {
    patch.requestDelayDays = input.requestDelayDays;
  }
  if (
    typeof input.reminderDelayDays === "number" &&
    input.reminderDelayDays >= 0 &&
    input.reminderDelayDays <= 90
  ) {
    patch.reminderDelayDays = input.reminderDelayDays;
  }
  if (typeof input.emailEnabled === "boolean") {
    patch.emailEnabled = input.emailEnabled;
  }
  if (typeof input.widgetEnabled === "boolean") {
    patch.widgetEnabled = input.widgetEnabled;
  }

  if (Object.keys(patch).length === 0) {
    return existing;
  }

  return db.orm.public.ShopSettings.where({ id: existing.id }).update(patch);
}

export async function listShopProducts(shopId: string, limit = 100) {
  const db = getDb();
  return db.orm.public.Product.where({ shopId })
    .orderBy((product) => product.title.asc())
    .limit(limit)
    .all();
}

export async function listShopMedia(shopId: string, limit = 60) {
  const reviews = await import("@/services/reviews/moderation").then((mod) =>
    mod.listDashboardReviews({ shopId, hasMedia: true, limit }),
  );

  return reviews.flatMap((review) =>
    review.media.map((item) => ({
      ...item,
      reviewId: review.id,
      rating: review.rating,
      productTitle: review.product.title,
      reviewerName: review.reviewerName,
      createdAt: review.createdAt,
    })),
  );
}

export async function getAnalyticsSummary(shopId: string) {
  const db = getDb();

  const [byStatus, byRating, requestStats] = await Promise.all([
    Promise.all(
      (["pending", "published", "rejected"] as const).map(async (status) => {
        const result = await db.orm.public.Review.where({
          shopId,
          status,
        }).aggregate((agg) => ({ count: agg.count() }));
        return { status, count: result?.count ?? 0 };
      }),
    ),
    Promise.all(
      ([1, 2, 3, 4, 5] as const).map(async (rating) => {
        const result = await db.orm.public.Review.where({
          shopId,
          rating,
        }).aggregate((agg) => ({ count: agg.count() }));
        return { rating, count: result?.count ?? 0 };
      }),
    ),
    Promise.all(
      (["pending", "sent", "opened", "completed", "expired"] as const).map(
        async (status) => {
          const result = await db.orm.public.ReviewRequest.where({
            shopId,
            status,
          }).aggregate((agg) => ({ count: agg.count() }));
          return { status, count: result?.count ?? 0 };
        },
      ),
    ),
  ]);

  const published = await db.orm.public.Review.where({
    shopId,
    status: "published",
  }).aggregate((agg) => ({
    count: agg.count(),
    averageRating: agg.avg("rating"),
  }));

  return {
    byStatus,
    byRating,
    requestStats,
    publishedCount: published?.count ?? 0,
    averageRating: Number(published?.averageRating ?? 0),
  };
}
