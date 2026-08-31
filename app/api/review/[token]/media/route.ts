import { NextRequest, NextResponse } from "next/server";
import {
  findReviewRequestByRawToken,
  ReviewRequestError,
} from "@/services/reviews/request";
import { createReviewUploadPermission } from "@/services/media/presign";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params;
    const reviewRequest = await findReviewRequestByRawToken(token);

    if (!reviewRequest) {
      throw new ReviewRequestError("This review link is invalid.", "not_found");
    }

    if (reviewRequest.status === "completed") {
      throw new ReviewRequestError(
        "You already submitted a review for this product.",
        "already_completed",
      );
    }

    const body = await request.json();
    const contentType =
      typeof body.contentType === "string" ? body.contentType : "";
    const contentLength = Number(body.contentLength);
    const sortOrder = Number(body.sortOrder ?? 0);

    if (!contentType) {
      return NextResponse.json({ error: "Missing content type" }, { status: 400 });
    }

    if (!Number.isFinite(contentLength) || contentLength < 1) {
      return NextResponse.json({ error: "Invalid content length" }, { status: 400 });
    }

    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 4) {
      return NextResponse.json({ error: "Invalid sort order" }, { status: 400 });
    }

    const upload = await createReviewUploadPermission({
      shopId: reviewRequest.shopId,
      requestId: reviewRequest.id,
      contentType,
      contentLength,
    });

    return NextResponse.json({
      ok: true,
      mediaKey: upload.mediaKey,
      uploadUrl: upload.uploadUrl,
      publicUrl: upload.publicUrl,
      headers: upload.headers,
      expiresInSeconds: upload.expiresInSeconds,
      sortOrder,
    });
  } catch (error) {
    if (error instanceof ReviewRequestError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Upload permission failed",
      },
      { status: 400 },
    );
  }
}
