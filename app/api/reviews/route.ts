import { NextRequest, NextResponse } from "next/server";
import { requireApiShop } from "@/lib/dashboard/shop-context";
import {
  bulkSetReviewStatus,
  listManageReviews,
} from "@/services/reviews/moderation";
import { listShopProducts } from "@/services/dashboard/data";
import { getShopSettings } from "@/services/dashboard/data";

export async function GET(request: NextRequest) {
  const shopParam = request.nextUrl.searchParams.get("shop");
  const auth = await requireApiShop(shopParam);

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const status = request.nextUrl.searchParams.get("status") ?? "all";
  const ratingParam = request.nextUrl.searchParams.get("rating");
  const hasMedia = request.nextUrl.searchParams.get("hasMedia") === "true";
  const productId = request.nextUrl.searchParams.get("productId") ?? undefined;
  const search = request.nextUrl.searchParams.get("q") ?? undefined;
  const sort = (request.nextUrl.searchParams.get("sort") ?? "newest") as
    | "newest"
    | "oldest"
    | "highest"
    | "lowest";
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? 50);
  const offset = Number(request.nextUrl.searchParams.get("offset") ?? 0);
  const rating = ratingParam ? Number(ratingParam) : undefined;
  const includeMeta = request.nextUrl.searchParams.get("meta") === "1";

  const result = await listManageReviews({
    shopId: auth.shop.id,
    status: status as
      | "pending"
      | "published"
      | "rejected"
      | "approved"
      | "spam"
      | "all",
    rating: rating && rating >= 1 && rating <= 5 ? rating : undefined,
    hasMedia: hasMedia || undefined,
    productId,
    search,
    sort,
    limit: Number.isFinite(limit) ? limit : 50,
    offset: Number.isFinite(offset) ? offset : 0,
  });

  const payload: Record<string, unknown> = {
    reviews: result.reviews.map((review) => ({
      ...review,
      createdAt: review.createdAt.toISOString(),
      publishedAt: review.publishedAt?.toISOString() ?? null,
      merchantRepliedAt: review.merchantRepliedAt?.toISOString() ?? null,
      replies: review.replies.map((reply) => ({
        ...reply,
        publishedAt: reply.publishedAt.toISOString(),
      })),
    })),
    total: result.total,
    averageRating: result.averageRating,
    pendingCount: result.pendingCount,
    publishedCount: result.publishedCount,
    rejectedCount: result.rejectedCount,
  };

  if (includeMeta) {
    const [products, settings] = await Promise.all([
      listShopProducts(auth.shop.id, 200),
      getShopSettings(auth.shop.id),
    ]);
    payload.products = products.map((product) => ({
      id: product.id,
      title: product.title,
    }));
    payload.settings = {
      autoPublishReviews: settings.autoPublishReviews,
      minRatingToPublish: settings.minRatingToPublish,
    };
  }

  return NextResponse.json(payload);
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireApiShop(request.nextUrl.searchParams.get("shop"));
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const action = body.action as string;
    const reviewIds = Array.isArray(body.reviewIds)
      ? body.reviewIds.filter((id: unknown): id is string => typeof id === "string")
      : [];

    if (action === "bulk_status") {
      const status = body.status as "published" | "pending" | "rejected";
      if (!["published", "pending", "rejected"].includes(status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      if (reviewIds.length === 0) {
        return NextResponse.json({ error: "No reviews selected" }, { status: 400 });
      }
      await bulkSetReviewStatus({
        shopId: auth.shop.id,
        reviewIds: reviewIds.slice(0, 100),
        status,
      });
      return NextResponse.json({ ok: true, updated: reviewIds.length });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed" },
      { status: 400 },
    );
  }
}
