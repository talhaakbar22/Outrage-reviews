import { NextRequest, NextResponse } from "next/server";
import { requireApiShop } from "@/lib/dashboard/shop-context";
import {
  approveReview,
  getDashboardReview,
  rejectReview,
  replyToReview,
  setReviewStatus,
  suggestReviewReply,
} from "@/services/reviews/moderation";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const auth = await requireApiShop(request.nextUrl.searchParams.get("shop"));

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const review = await getDashboardReview(auth.shop.id, id);
  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  return NextResponse.json({ review });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const auth = await requireApiShop(request.nextUrl.searchParams.get("shop"));

    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const action = body.action as string;

    if (action === "approve") {
      await approveReview(auth.shop.id, id);
    } else if (action === "reject") {
      await rejectReview(auth.shop.id, id);
    } else if (action === "set_status") {
      const status = body.status as "published" | "pending" | "rejected";
      if (!["published", "pending", "rejected"].includes(status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      await setReviewStatus(auth.shop.id, id, status);
    } else if (action === "reply") {
      await replyToReview({
        shopId: auth.shop.id,
        reviewId: id,
        body: typeof body.body === "string" ? body.body : "",
        authorName: auth.shop.name,
      });
    } else if (action === "suggest_reply") {
      const review = await getDashboardReview(auth.shop.id, id);
      if (!review) {
        return NextResponse.json({ error: "Review not found" }, { status: 404 });
      }
      return NextResponse.json({
        ok: true,
        suggestion: suggestReviewReply({
          rating: review.rating,
          reviewerName: review.reviewerName,
          productTitle: review.product.title,
          body: review.body,
        }),
      });
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    const review = await getDashboardReview(auth.shop.id, id);
    return NextResponse.json({ ok: true, review });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed" },
      { status: 400 },
    );
  }
}
