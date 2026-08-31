import { NextRequest, NextResponse } from "next/server";
import {
  loadReviewRequestContext,
  ReviewRequestError,
} from "@/services/reviews/request";
import { submitReviewFromToken } from "@/services/reviews/submit";

type RouteContext = {
  params: Promise<{ token: string }>;
};

function errorResponse(error: unknown) {
  if (error instanceof ReviewRequestError) {
    const status =
      error.code === "not_found" || error.code === "invalid_token"
        ? 404
        : error.code === "duplicate_review" || error.code === "already_completed"
          ? 409
          : 400;

    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }

  console.error("Review request error:", error);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params;
    const data = await loadReviewRequestContext(token);

    return NextResponse.json({
      product: data.product,
      shopName: data.shop.name ?? data.shop.shopifyDomain,
      customerName: data.customerName,
      emailHint: data.request.email.replace(/^(.)(.+)(@.*)$/, "$1***$3"),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params;
    const body = await request.json();

    const rating = Number(body.rating);
    const reviewBody = typeof body.body === "string" ? body.body : "";
    const title = typeof body.title === "string" ? body.title : null;
    const reviewerName =
      typeof body.reviewerName === "string" ? body.reviewerName : null;
    const media = Array.isArray(body.media)
      ? body.media
          .filter(
            (item: unknown): item is { mediaKey: string; sortOrder: number } =>
              typeof item === "object" &&
              item !== null &&
              "mediaKey" in item &&
              "sortOrder" in item &&
              typeof (item as { mediaKey: unknown }).mediaKey === "string" &&
              typeof (item as { sortOrder: unknown }).sortOrder === "number",
          )
          .slice(0, 5)
      : [];

    const result = await submitReviewFromToken({
      token,
      rating,
      body: reviewBody,
      title,
      reviewerName,
      media,
    });

    return NextResponse.json({
      ok: true,
      reviewId: result.reviewId,
      status: result.status,
      message:
        result.status === "published"
          ? "Thank you! Your review has been published."
          : "Thank you! Your review was submitted and is pending approval.",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
