import { NextRequest, NextResponse } from "next/server";
import {
  normalizeProxyShopDomain,
  verifyAppProxySignature,
} from "@/lib/shopify/app-proxy";
import {
  submitReviewFromWidget,
  WidgetReviewError,
} from "@/services/reviews/submit-widget";

function corsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("origin")),
  });
}

/**
 * App proxy: POST /apps/outrage-reviews/submit-review
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const params = request.nextUrl.searchParams;

  if (params.has("signature") && !verifyAppProxySignature(params)) {
    return NextResponse.json(
      { error: "Invalid proxy signature" },
      { status: 401, headers: corsHeaders(origin) },
    );
  }

  try {
    const body = await request.json();
    const shopDomain = normalizeProxyShopDomain(
      params.get("shop") ?? (typeof body.shop === "string" ? body.shop : null),
    );
    const productId =
      typeof body.product_id === "string"
        ? body.product_id
        : typeof body.productId === "string"
          ? body.productId
          : null;

    if (!shopDomain || !productId) {
      return NextResponse.json(
        { error: "shop and product_id are required" },
        { status: 400, headers: corsHeaders(origin) },
      );
    }

    const media = Array.isArray(body.media)
      ? body.media
          .filter((item: unknown): item is {
            mediaKey: string;
            sortOrder: number;
            mediaType?: string;
          } =>
            typeof item === "object" &&
            item !== null &&
            typeof (item as { mediaKey?: unknown }).mediaKey === "string" &&
            Number.isInteger(Number((item as { sortOrder?: unknown }).sortOrder)),
          )
          .map(
            (item: {
              mediaKey: string;
              sortOrder: number;
              mediaType?: string;
            }) => ({
              mediaKey: item.mediaKey,
              sortOrder: Number(item.sortOrder),
              mediaType:
                item.mediaType === "video" ? ("video" as const) : ("image" as const),
            }),
          )
      : [];

    const result = await submitReviewFromWidget({
      shopDomain,
      shopifyProductId: productId,
      uploadSessionId: String(body.upload_session_id ?? ""),
      rating: Number(body.rating),
      body: String(body.body ?? ""),
      firstName: String(body.first_name ?? body.firstName ?? ""),
      lastName:
        typeof body.last_name === "string"
          ? body.last_name
          : typeof body.lastName === "string"
            ? body.lastName
            : null,
      email: String(body.email ?? ""),
      media,
    });

    return NextResponse.json(
      {
        ok: true,
        ...result,
      },
      { headers: corsHeaders(origin) },
    );
  } catch (error) {
    if (error instanceof WidgetReviewError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400, headers: corsHeaders(origin) },
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Submission failed",
      },
      { status: 500, headers: corsHeaders(origin) },
    );
  }
}
