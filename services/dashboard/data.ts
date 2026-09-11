import { getDb } from "@/lib/prisma";
import type { ShopBranding } from "@/services/email/editable-templates";

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

export async function updateShopSettingsBranding(
  shopId: string,
  branding: ShopBranding,
) {
  const db = getDb();
  const existing = await getShopSettings(shopId);
  return db.orm.public.ShopSettings.where({ id: existing.id }).update({
    branding: JSON.parse(JSON.stringify(branding)) as never,
  });
}

export async function listShopProducts(shopId: string, limit = 100) {
  const db = getDb();
  return db.orm.public.Product.where({ shopId })
    .orderBy((product) => product.title.asc())
    .limit(limit)
    .all();
}

export type ListShopProductsQuery = {
  search?: string;
  status?: "active" | "archived" | "draft" | "all";
  hasReviews?: "all" | "with" | "without";
  minRating?: number | null;
  sort?: "title" | "rating" | "reviews";
  page?: number;
  pageSize?: number;
};

export type ShopProductListItem = {
  id: string;
  title: string;
  handle: string | null;
  shopifyProductId: string;
  imageUrl: string | null;
  avgRating: number | null;
  reviewCount: number;
  status: string;
};

function sortProducts(
  products: ShopProductListItem[],
  sort: "title" | "rating" | "reviews",
) {
  const copy = [...products];
  copy.sort((a, b) => {
    if (sort === "rating") {
      return (b.avgRating ?? -1) - (a.avgRating ?? -1);
    }
    if (sort === "reviews") {
      return (b.reviewCount ?? 0) - (a.reviewCount ?? 0);
    }
    return a.title.localeCompare(b.title);
  });
  return copy;
}

export async function listShopProductsPage(
  shopId: string,
  query: ListShopProductsQuery = {},
) {
  const db = getDb();
  const pageSize = Math.min(Math.max(query.pageSize ?? 20, 1), 100);
  const page = Math.max(query.page ?? 1, 1);
  const offset = (page - 1) * pageSize;
  const search = query.search?.trim() ?? "";
  const status = query.status ?? "all";
  const hasReviews = query.hasReviews ?? "all";
  const minRating =
    typeof query.minRating === "number" && query.minRating >= 1
      ? query.minRating
      : null;
  const sort = query.sort ?? "title";

  let collection = db.orm.public.Product.where({ shopId });

  if (status !== "all") {
    collection = collection.where({ status });
  }

  if (hasReviews === "with") {
    collection = collection.where((product) => product.reviewCount.gt(0));
  } else if (hasReviews === "without") {
    collection = collection.where((product) => product.reviewCount.eq(0));
  }

  if (minRating != null) {
    collection = collection.where((product) =>
      product.avgRating.gte(minRating),
    );
  }

  if (search) {
    const pattern = `%${search.replace(/[%_]/g, "\\$&")}%`;
    const [byTitle, byHandle] = await Promise.all([
      collection.where((product) => product.title.ilike(pattern)).all(),
      collection.where((product) => product.handle.ilike(pattern)).all(),
    ]);

    const merged = new Map<string, ShopProductListItem>();
    for (const product of [...byTitle, ...byHandle]) {
      merged.set(product.id, product as ShopProductListItem);
    }

    const sorted = sortProducts([...merged.values()], sort);
    const total = sorted.length;
    const products = sorted.slice(offset, offset + pageSize);

    return {
      products,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  const totalAgg = await collection.aggregate((agg) => ({
    count: agg.count(),
  }));
  const total = Number(totalAgg?.count ?? 0);

  const ordered =
    sort === "rating"
      ? collection.orderBy((product) => product.avgRating.desc())
      : sort === "reviews"
        ? collection.orderBy((product) => product.reviewCount.desc())
        : collection.orderBy((product) => product.title.asc());

  const products = (await ordered
    .offset(offset)
    .limit(pageSize)
    .all()) as ShopProductListItem[];

  return {
    products,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
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
